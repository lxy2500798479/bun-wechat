
import { Router } from '../lib/router.ts';
// 1. 导入我们新改造的 chat controller 函数
import { receiveChatHandler } from '../controllers/chat.controller.ts';
import {R} from "../lib/response.ts";

const router = new Router({basePath:'/api'});

router.get('/', () => {
    return R.success('Hello, World!');
});


// 2. 注册 POST /v1/receive 路由，指向我们的新函数
// 这条路由完全对应您项目中的核心功能
router.post('/v1/receive', receiveChatHandler);

export default router;