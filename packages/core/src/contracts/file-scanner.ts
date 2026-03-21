/**
 * 文件扫描器接口，用于枚举仓库中的候选文件。
 */
export interface FileScanner {
  /**
   * 扫描仓库根目录并返回候选文件路径列表。
   */
  scan(rootPath: string): Promise<string[]>;
}
