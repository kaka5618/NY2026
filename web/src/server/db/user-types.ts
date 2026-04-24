/**
 * 用户表对外形态（API / JWT），与 PostgreSQL `users` 行对应。
 */
export interface UserRowPublic {
  /** 自增主键，序列化为字符串避免大整数精度问题 */
  id: string;
  username: string;
  email: string;
  nickname: string;
  /** 注册时间（Unix 毫秒） */
  createdAt: number;
}

/**
 * 含密码哈希，仅服务端登录校验使用。
 */
export interface UserRowDb extends UserRowPublic {
  passwordHash: string;
}

/**
 * 写入数据库所需字段（由数据库生成 id、created_at）。
 */
export interface CreateUserInput {
  username: string;
  email: string;
  passwordHash: string;
  nickname: string;
}
