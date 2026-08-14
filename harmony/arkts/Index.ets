/**
 * 云元伴学 · 鸿蒙 HAP 轻壳骨架
 * ============================================================
 * 说明：本文件为 ArkUI 页面骨架，需用 DevEco Studio 打开编译验证；
 * 本仓库不内置鸿蒙工程构建（entry/build-profile 等按模板补齐）。
 *
 * 两种用法：
 *  A. Web 容器直接加载云元学生端（最快，复用全部现有体验）
 *  B. 原生对话页：用 ohos.net.http 调 /edu/chat（示例见文件底部注释）
 * ============================================================
 */

import { webview } from '@kit.ArkWeb';

// 部署后的学生端地址（本地开发可用电脑局域网 IP + 端口）
const STUDENT_PORTAL_URL: string = 'https://your-domain.example/student';
// 本地调试示例：'http://192.168.1.100:3000/student'

@Entry
@Component
struct Index {
  controller: webview.WebviewController = new webview.WebviewController();

  build() {
    Column() {
      // 顶部品牌条
      Row() {
        Text('云元伴学')
          .fontSize(18)
          .fontWeight(FontWeight.Bold)
        Blank()
        Text('会把握分寸的 AI 教练')
          .fontSize(12)
          .fontColor('#888888')
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 12, bottom: 12 })

      // 学生端 Web 容器
      Web({ src: STUDENT_PORTAL_URL, controller: this.controller })
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .layoutWeight(1)
    }
    .width('100%')
    .height('100%')
  }
}

/* ============================================================
 * 用法 B：原生对话页调用伴学接口（ohos.net.http 示例）
 * ------------------------------------------------------------
 * import { http } from '@kit.NetworkKit';
 *
 * const TOKEN = '<登录 token>'; // 先用 /auth/login 获取
 *
 * async function askTutor(question: string): Promise<string> {
 *   const req = http.createHttp();
 *   const resp = await req.request('http://127.0.0.1:18080/edu/chat', {
 *     method: http.RequestMethod.POST,
 *     header: {
 *       'Content-Type': 'application/json',
 *       'Authorization': `Bearer ${TOKEN}`,
 *     },
 *     extraData: JSON.stringify({
 *       student_id: 'student_001',
 *       course_id: 'course_db',
 *       question,
 *       history: [],
 *       page_context: {
 *         scene: 'free_chat',
 *         visible_summary: '鸿蒙原生对话页',
 *       },
 *     }),
 *   });
 *   const body = JSON.parse(resp.result as string);
 *   // body.message    → 引导性回复（以提问结尾）
 *   // body.trust.level → locked / hint / partial / explain
 *   return body.message as string;
 * }
 * ============================================================
 */
