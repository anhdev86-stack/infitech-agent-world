#!/usr/bin/env node
// Starts the INFI TECH Agent World server if needed and opens it in the default browser.
'use strict';
const { ensureServer, health, openViewer, URL } = require('./lib');
(async () => {
  await ensureServer();
  if (await health()) {
    openViewer();
    console.log(`INFI TECH Agent World đang chạy tại ${URL} (đã mở trong trình duyệt).`);
  } else {
    console.log('Không khởi động được server INFI TECH Agent World. Kiểm tra Node.js 18+ và cổng 8765 có đang bị chương trình khác dùng không.');
  }
})();
