// src/lib/response.ts

/**
 * 统一的 API 响应工具类
 * 所有方法均为静态方法，直接通过 R.success() 等方式调用
 */
export class R {
    /**
     * 成功响应
     * @param data - 要返回的数据，默认为 null
     * @param msg - 成功消息，默认为 '操作成功'
     * @returns - 一个包含成功信息的 Response 对象
     */
    public static success(data: any = null, msg = '操作成功'): Response {
        return Response.json({
            code: 200,
            msg,
            data,
        });
    }

    /**
     * 创建成功的响应 (HTTP 201 Created)
     * @param data - 创建的资源数据
     * @returns - 一个表示创建成功的 Response 对象
     */
    public static created(data: any): Response {
        return Response.json(
            {
                code: 201,
                msg: '创建成功',
                data,
            },
            { status: 201 },
        );
    }

    /**
     * 无内容响应 (HTTP 204 No Content)
     * 通常用于删除成功等场景
     * @returns - 一个状态码为 204 的空 Response 对象
     */
    public static noContent(): Response {
        return new Response(null, { status: 204 });
    }

    /**
     * 通用的失败响应方法
     * @param msg - 错误消息
     * @param statusCode - HTTP 状态码
     * @param data - 额外的错误数据（可选）
     * @returns - 一个包含错误信息的 Response 对象
     */
    private static fail(msg: string, statusCode: number, data: any = null): Response {
        return Response.json(
            {
                code: statusCode,
                msg,
                data,
            },
            { status: statusCode },
        );
    }

    /**
     * 错误请求 (HTTP 400 Bad Request)
     * @param msg - 错误消息，默认为 '请求参数错误'
     * @param data - 额外的错误数据（可选）
     * @returns - Response 对象
     */
    public static badRequest(msg = '请求参数错误', data: any = null): Response {
        return this.fail(msg, 400, data);
    }

    /**
     * 未授权 (HTTP 401 Unauthorized)
     * @param msg - 错误消息，默认为 '身份验证失败'
     * @returns - Response 对象
     */
    public static unauthorized(msg = '身份验证失败'): Response {
        return this.fail(msg, 401);
    }

    /**
     * 禁止访问 (HTTP 403 Forbidden)
     * @param msg - 错误消息，默认为 '权限不足'
     * @returns - Response 对象
     */
    public static forbidden(msg = '权限不足'): Response {
        return this.fail(msg, 403);
    }

    /**
     * 未找到 (HTTP 404 Not Found)
     * @param msg - 错误消息，默认为 '请求的资源未找到'
     * @returns - Response 对象
     */
    public static notFound(msg = '请求的资源未找到'): Response {
        return this.fail(msg, 404);
    }

    /**
     * 服务器内部错误 (HTTP 500 Internal Server Error)
     * @param msg - 错误消息，默认为 '服务器内部错误'
     * @returns - Response 对象
     */
    public static serverError(msg = '服务器内部错误'): Response {
        return this.fail(msg, 500);
    }
}