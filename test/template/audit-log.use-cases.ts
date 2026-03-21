import { BadRequestException, Injectable } from "@nestjs/common";
import type {
  AclAuditLogItem,
  ExportAclAuditLogsRequest,
  ExportAclAuditLogsResponse,
  ListAclAuditLogsRequest,
  ListAclAuditLogsResponse,
} from "~/proto/generated/audit/audit";
import type { AclAuditLogModel } from "@domain/audit";
import { AclAuditPgRepository } from "@infra/repositories/audit/acl-audit.repository";

/** 分页查询单页最大条数限制 */
const MAX_PAGE_SIZE = 100;
/** 分页查询默认每页条数 */
const DEFAULT_PAGE_SIZE = 20;
/** 导出日志默认条数上限 */
const DEFAULT_EXPORT_LIMIT = 1000;
/** 导出日志最大条数上限 */
const MAX_EXPORT_LIMIT = 5000;

/**
 * 审计日志用例服务
 *
 * 负责审计日志的业务逻辑处理，包括：
 * - 分页查询审计日志
 * - 按条件导出审计日志
 * - 参数校验与规范化（分页大小、时间格式、数组去重等）
 *
 * @remarks
 * - 依赖 AclAuditPgRepository 查询数据库
 * - 对外提供 REST 与 gRPC 接口的统一业务逻辑
 * - 不涉及缓存策略（审计日志为只读历史数据）
 */
@Injectable()
export class AuditLogUseCases {
  constructor(private readonly auditRepository: AclAuditPgRepository) {}

  /**
   * 分页查询审计日志
   *
   * 处理流程：
   * 1. 规范化与校验请求参数（分页、筛选条件、时间范围等）
   * 2. 调用仓储层查询数据库
   * 3. 将领域模型转换为 proto DTO 并返回
   *
   * @param {ListAclAuditLogsRequest} request - 分页查询请求（来自 REST 或 gRPC）
   * @returns {Promise<ListAclAuditLogsResponse>} 分页结果（包含总数与当前页数据）
   *
   * @example
   * const response = await useCases.listAuditLogs({
   *   page: 1,
   *   pageSize: 20,
   *   actions: ['assign_role', 'revoke_role'],
   *   occurredStart: '2025-01-01T00:00:00.000Z',
   * });
   */
  async listAuditLogs(
    request: ListAclAuditLogsRequest,
  ): Promise<ListAclAuditLogsResponse> {
    const page = request.page > 0 ? request.page : 1;
    const pageSize = this.normalizePageSize(request.pageSize);
    const actorId = this.normalizeActorId(request.actorId);
    const actions = this.normalizeStringArray(request.actions, 20);
    const targetTypes = this.normalizeStringArray(request.targetTypes, 20);
    const targetId = request.targetId?.trim() || undefined;
    const keyword = request.keyword?.trim() || undefined;
    const occurredStart = this.normalizeDateTime(request.occurredStart);
    const occurredEnd = this.normalizeDateTime(request.occurredEnd);
    const ipAddress = request.ipAddress?.trim() || undefined;

    this.validateTimeRange(occurredStart, occurredEnd);

    const result = await this.auditRepository.listLogs({
      page,
      pageSize,
      actorId,
      actions,
      targetTypes,
      targetId,
      keyword,
      occurredStart,
      occurredEnd,
      ipAddress,
    });

    return {
      items: result.items.map((item) => this.toDto(item)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    } satisfies ListAclAuditLogsResponse;
  }

  /**
   * 按条件导出审计日志
   *
   * 与分页查询类似，但不分页，直接返回指定条数上限的记录列表，
   * 用于导出 CSV/JSON 或批量分析场景。
   *
   * @param {ExportAclAuditLogsRequest} request - 导出请求（包含筛选条件与条数上限）
   * @returns {Promise<ExportAclAuditLogsResponse>} 导出结果（审计日志数组）
   *
   * @example
   * const response = await useCases.exportAuditLogs({
   *   limit: 1000,
   *   targetTypes: ['user'],
   *   occurredStart: '2025-10-01T00:00:00.000Z',
   * });
   */
  async exportAuditLogs(
    request: ExportAclAuditLogsRequest,
  ): Promise<ExportAclAuditLogsResponse> {
    const limit = this.normalizeExportLimit(request.limit);
    const actorId = this.normalizeActorId(request.actorId);
    const actions = this.normalizeStringArray(request.actions, 50);
    const targetTypes = this.normalizeStringArray(request.targetTypes, 50);
    const targetId = request.targetId?.trim() || undefined;
    const keyword = request.keyword?.trim() || undefined;
    const occurredStart = this.normalizeDateTime(request.occurredStart);
    const occurredEnd = this.normalizeDateTime(request.occurredEnd);
    const ipAddress = request.ipAddress?.trim() || undefined;

    this.validateTimeRange(occurredStart, occurredEnd);

    const items = await this.auditRepository.exportLogs({
      limit,
      actorId,
      actions,
      targetTypes,
      targetId,
      keyword,
      occurredStart,
      occurredEnd,
      ipAddress,
    });

    return {
      items: items.map((item) => this.toDto(item)),
    } satisfies ExportAclAuditLogsResponse;
  }

  /**
   * 将领域模型转换为 proto DTO
   *
   * @param {AclAuditLogModel} model - 领域模型对象
   * @returns {AclAuditLogItem} proto DTO 对象
   * @private
   */
  private toDto(model: AclAuditLogModel): AclAuditLogItem {
    return {
      id: model.id,
      actorId: model.actorId,
      actorUsername: model.actorUsername,
      actorRealName: model.actorRealName,
      actorDisplayName: model.actorDisplayName,
      action: model.action,
      targetType: model.targetType,
      targetId: model.targetId,
      detail: model.detail,
      occurredAt: model.occurredAt,
      ipAddress: model.ipAddress,
      userAgent: model.userAgent,
    } satisfies AclAuditLogItem;
  }

  /**
   * 规范化分页大小
   *
   * 确保分页大小在合理范围内（1 ~ MAX_PAGE_SIZE），
   * 防止超大分页查询影响性能。
   *
   * @param {number} pageSize - 请求的分页大小
   * @returns {number} 规范化后的分页大小
   * @private
   */
  private normalizePageSize(pageSize?: number): number {
    if (!pageSize || pageSize <= 0) {
      return DEFAULT_PAGE_SIZE;
    }
    return Math.min(pageSize, MAX_PAGE_SIZE);
  }

  /**
   * 规范化操作者 ID
   *
   * 过滤无效值（undefined、0、负数），返回有效的用户 ID 或 undefined。
   *
   * @param {number} actorId - 请求的操作者 ID
   * @returns {number | undefined} 规范化后的操作者 ID
   * @private
   */
  private normalizeActorId(actorId?: number): number | undefined {
    if (!actorId || actorId <= 0) {
      return undefined;
    }
    return actorId;
  }

  /**
   * 规范化字符串数组
   *
   * 处理流程：
   * 1. 去除空值与前后空格
   * 2. 去重（保留首次出现位置）
   * 3. 限制数组长度不超过 max
   *
   * @param {string[]} values - 原始字符串数组
   * @param {number} max - 允许的最大数组长度
   * @returns {string[] | undefined} 规范化后的数组或 undefined
   * @private
   */
  private normalizeStringArray(
    values: string[] | undefined,
    max: number,
  ): string[] | undefined {
    if (!values || values.length === 0) {
      return undefined;
    }
    const sanitized = values
      .map((value) => value.trim())
      .filter(
        (value, index, arr) => value.length > 0 && arr.indexOf(value) === index,
      );
    if (sanitized.length === 0) {
      return undefined;
    }
    if (sanitized.length > max) {
      return sanitized.slice(0, max);
    }
    return sanitized;
  }

  /**
   * 规范化日期时间字符串
   *
   * 将各种格式的日期时间字符串统一转换为 ISO 8601 格式（UTC），
   * 便于数据库查询与前后端交互。
   *
   * @param {string} value - 日期时间字符串（如 '2025-10-23' 或 '2025-10-23T12:00:00Z'）
   * @returns {string | undefined} ISO 8601 格式的日期时间字符串或 undefined
   * @throws {BadRequestException} 当时间格式无法解析时抛出异常
   * @private
   */
  private normalizeDateTime(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const timestamp = Date.parse(trimmed);
    if (Number.isNaN(timestamp)) {
      throw new BadRequestException("时间格式不合法");
    }
    return new Date(timestamp).toISOString();
  }

  /**
   * 规范化导出条数上限
   *
   * 确保导出条数在合理范围内（1 ~ MAX_EXPORT_LIMIT），
   * 防止超大导出查询影响数据库性能。
   *
   * @param {number} limit - 请求的导出条数上限
   * @returns {number} 规范化后的导出条数上限
   * @private
   */
  private normalizeExportLimit(limit?: number): number {
    if (!limit || limit <= 0) {
      return DEFAULT_EXPORT_LIMIT;
    }
    return Math.min(limit, MAX_EXPORT_LIMIT);
  }

  /**
   * 校验时间范围合法性
   *
   * 确保开始时间不晚于结束时间，避免无效查询。
   *
   * @param {string} start - 开始时间（ISO 8601 格式）
   * @param {string} end - 结束时间（ISO 8601 格式）
   * @throws {BadRequestException} 当开始时间晚于结束时间时抛出异常
   * @private
   */
  private validateTimeRange(start?: string, end?: string): void {
    if (start && end && new Date(start).getTime() > new Date(end).getTime()) {
      throw new BadRequestException("开始时间不能晚于结束时间");
    }
  }
}
