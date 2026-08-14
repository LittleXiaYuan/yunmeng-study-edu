"use client";

import { StudentProfile } from "./student-profile";

/** 画像内容；滚动由 StudentPortal 的 #student-scroll-root 负责。 */
export function ProfileScene() {
  return (
    <div style={{ paddingBottom: 48 }}>
      <StudentProfile />
    </div>
  );
}
