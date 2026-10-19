# INFI TECH Agent World

Plugin cho Claude Code: một văn phòng 3D nơi sáu robot diễn lại đúng những gì Claude Code đang làm trên máy bạn: lập kế hoạch, nghiên cứu, viết code, chạy test và review.

*Infinite Solutions • Smarter Future*

## Có gì

- **Robot làm theo việc thật.** Mỗi yêu cầu bạn gửi Claude là một task. Đọc/tìm file → Iris, sửa file và chạy lệnh → Kai, chạy test → Quinn, lập kế hoạch → Piper, giao subagent → Orion, xong lượt → Rex review rồi Orion chốt.
- **Mỗi phiên một phòng riêng.** Tối đa 4 phiên Claude Code cùng hiện, mỗi phòng có tên dự án, trạng thái và các hành động mới nhất.
- **Thống kê:** số yêu cầu, hành động, tỉ lệ lỗi, file sửa nhiều nhất, thời gian Claude làm việc, theo giờ hoặc 7 ngày.
- **Khung chat:** soạn tin ngay trong trang, bấm Gửi để chép sang Claude Code (dán rồi Enter). Cuộc trò chuyện, từng bước robot làm và câu trả lời cuối của Claude hiện lại trong khung chat.
- **Thông báo** khi Claude xong việc hoặc đang chờ bạn duyệt (cần cho phép thông báo trong trình duyệt).
- Hiệu ứng ánh sáng, sàn phản chiếu, camera tự động, giao diện tiếng Việt.

## Cài đặt

Cần **Node.js 18 trở lên** (Mac, Windows hoặc Linux).

Trong Claude Code, gõ:

```
/plugin marketplace add anhdev86-stack/infitech-agent-world
/plugin install agent-world@infitech
```

Sau đó mở một phiên Claude Code mới. Văn phòng 3D tự mở trong trình duyệt tại http://127.0.0.1:8765, robot bắt đầu làm theo Claude.

Nếu nhận được thư mục này qua file zip thay vì GitHub, giải nén rồi dùng đường dẫn thư mục:

```
/plugin marketplace add /đường/dẫn/tới/thư-mục-đã-giải-nén
/plugin install agent-world@infitech
```

## Lệnh

| Lệnh | Tác dụng |
| --- | --- |
| `/agent-world:open` | Mở lại văn phòng 3D trong trình duyệt |
| `/agent-world:stop` | Tắt server cục bộ |

## Tuỳ chỉnh (biến môi trường)

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `AGENT_WORLD_AUTO_OPEN` | `1` | Đặt `0` để không tự mở trình duyệt khi server khởi động |
| `AGENT_WORLD_PORT` | `8765` | Cổng của server |
| `AGENT_WORLD_DATA` | `~/.agent-world` | Nơi lưu nhật ký sự kiện |

## Dữ liệu và quyền riêng tư

- Server chỉ nghe trên `127.0.0.1`, máy khác không truy cập được.
- Sự kiện (câu bạn gửi Claude, tên công cụ, đường dẫn file, lệnh đã chạy, rút gọn) lưu ở `~/.agent-world/events.jsonl`, giữ 7 ngày, tự cắt khi vượt 24 MB. Không gửi đi đâu.
- Hook không in gì ra và luôn thoát thành công, nên không làm thay đổi cách Claude làm việc.

## Gỡ

```
/plugin uninstall agent-world@infitech
```

Xoá thư mục `~/.agent-world` nếu muốn xoá cả nhật ký.
