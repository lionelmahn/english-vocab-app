import { AudioLines, ChevronRight, Volume2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { BackButton, Segmented, Select } from '../components/kit'
import { Button, Card, Page, SectionTitle, Switch } from '../components/ui'
import { voiceLabel } from '../core/voices'
import { updateSettings, useSettings } from '../lib/settings'
import { playDemo } from '../lib/sfx'
import { englishVoices, hasExactVoice, isAppleDevice, isAppleMobile, pickVoice, previewVoice, speechAvailable, useVoicesReady } from '../services/speech'
import { useClipKeys } from '../services/voiceClips'

/** Các trang cài đặt con của Cá nhân: cách học và ôn, giọng đọc, giao diện và âm thanh. */

function SettingRow({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="flex-1">
        <p className="text-[0.9375rem] font-medium">{title}</p>
        {description && <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted">{description}</p>}
      </div>
      {children}
    </div>
  )
}

// ---- Cách học và ôn ---------------------------------------------------------------------------

export function StudySettingsPage() {
  const settings = useSettings()
  return (
    <Page title="Cách học và ôn" subtitle="Dùng chung trên mọi máy đăng nhập cùng tài khoản" back={<BackButton fallback="/me" />}>
      <Card>
        <SectionTitle className="mb-1">Kiểu ôn tập</SectionTitle>
        <p className="mb-3 text-[0.8125rem] leading-snug text-muted">
          {settings.reviewStyle === 'exercises' ? 'Trắc nghiệm, gõ từ và nghe viết; app tự chấm.' : 'Lật thẻ rồi tự chọn Quên / Khó / Nhớ / Dễ.'}
        </p>
        <Segmented
          layoutId="style"
          value={settings.reviewStyle}
          onChange={(v) => updateSettings({ reviewStyle: v })}
          options={[
            { value: 'exercises', label: 'Bài luyện' },
            { value: 'flashcard', label: 'Thẻ tự đánh giá' },
          ]}
        />
        {settings.reviewStyle === 'flashcard' && (
          <div className="mt-4">
            <p className="text-[0.9375rem] font-medium">Mặt trước thẻ khi ôn</p>
            <p className="mt-0.5 mb-2 text-[0.8125rem] leading-snug text-muted">Học từ mới luôn hiện tiếng Anh trước.</p>
            <Segmented
              layoutId="front"
              value={settings.flashcardFront}
              onChange={(v) => updateSettings({ flashcardFront: v })}
              options={[
                { value: 'term', label: 'Từ tiếng Anh' },
                { value: 'meaning', label: 'Nghĩa tiếng Việt' },
              ]}
            />
          </div>
        )}
        <div className="mt-4">
          <Select label="Tối đa mỗi buổi ôn" value={settings.reviewLimit} onChange={(e) => updateSettings({ reviewLimit: Number(e.target.value) })}>
            {[...new Set([20, 30, 50, 100, 200, settings.reviewLimit])]
              .sort((a, b) => a - b)
              .map((n) => (
                <option key={n} value={n}>
                  {n} từ
                </option>
              ))}
          </Select>
        </div>
      </Card>
      <Card>
        <SettingRow title="Tự phát âm" description="Đọc từ khi hiện thẻ và bài nghe.">
          <Switch label="Tự phát âm" checked={settings.autoPlay} onChange={(v) => updateSettings({ autoPlay: v })} />
        </SettingRow>
        <SettingRow title="Hiện bản dịch câu ví dụ" description="Có thể bật/tắt riêng ở từng từ.">
          <Switch label="Hiện bản dịch câu ví dụ" checked={settings.showTranslations} onChange={(v) => updateSettings({ showTranslations: v })} />
        </SettingRow>
      </Card>
    </Page>
  )
}

// ---- Giọng đọc --------------------------------------------------------------------------------

export function SpeechSettingsPage() {
  const settings = useSettings()
  useVoicesReady()
  const voiceMissing = speechAvailable() && !hasExactVoice(settings.accent)
  return (
    <Page title="Giọng đọc" subtitle="Giọng Anh–Mỹ hay Anh–Anh, giọng người thật hay giọng máy" back={<BackButton fallback="/me" />}>
      <Card>
        <p className="mb-2 text-[0.9375rem] font-medium">Giọng đọc</p>
        <Segmented
          layoutId="accent"
          value={settings.accent}
          onChange={(v) => updateSettings({ accent: v })}
          options={[
            { value: 'us', label: 'Anh–Mỹ' },
            { value: 'uk', label: 'Anh–Anh' },
          ]}
        />
        {voiceMissing && <p className="mt-2 text-xs text-warning">Thiết bị chưa có giọng {settings.accent === 'uk' ? 'Anh–Anh' : 'Anh–Mỹ'}; đang dùng giọng tiếng Anh khác.</p>}
        {!speechAvailable() && <p className="mt-2 text-xs text-warning">Trình duyệt này không hỗ trợ đọc. Các bài nghe sẽ được thay bằng bài gõ từ.</p>}
        <p className="mt-2 text-xs text-subtle">Dùng chung trên mọi máy; riêng giọng máy đã chọn bên dưới là của từng máy.</p>
      </Card>
      <Card>
        <VoiceSettings />
      </Card>
    </Page>
  )
}

/** Nguồn phát âm: bản ghi giọng người thật và giọng máy (chọn, nghe thử, hướng dẫn tải giọng tốt hơn). */
function VoiceSettings() {
  const settings = useSettings()
  const [help, setHelp] = useState(false)
  const accent = settings.accent
  const list = englishVoices(accent)
  const current = accent === 'uk' ? settings.voiceUK : settings.voiceUS
  const pinned = list.find((v) => v.voiceURI === current)
  const auto = pickVoice(accent, true)
  const apple = isAppleMobile()
  const appleDevice = isAppleDevice()
  const clipKeys = useClipKeys()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-3">
      <SettingRow title="Ưu tiên giọng người thật" description="Bản ghi phát âm từng từ từ Wiktionary. Câu ví dụ và từ chưa có bản ghi dùng giọng máy.">
        <Switch label="Ưu tiên giọng người thật" checked={settings.preferRecordings} onChange={(v) => updateSettings({ preferRecordings: v })} />
      </SettingRow>
      {appleDevice && (
        <button
          type="button"
          onClick={() => navigate('/voice')}
          className="flex items-center gap-3 rounded-2xl border-2 border-accent/40 bg-accent-soft p-3 text-left transition-transform active:scale-[0.98]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
            <AudioLines aria-hidden className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-bold text-accent-strong">Giọng iPhone (Nâng cao/Cao cấp)</span>
            <span className="block text-[0.8125rem] leading-snug text-muted">
              {clipKeys.size > 0 ? `Đã có ${clipKeys.size} âm thanh. ` : ''}Dùng giọng bạn tải trong Cài đặt, qua app Phím tắt.
            </span>
          </span>
          <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-accent" />
        </button>
      )}
      {(list.length > 0 || apple) && (
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Select
              label="Giọng máy"
              value={pinned ? pinned.voiceURI : ''}
              onChange={(e) => updateSettings(accent === 'uk' ? { voiceUK: e.target.value || null } : { voiceUS: e.target.value || null })}
            >
              <option value="">{apple ? 'Tự động: giọng chọn trong Cài đặt' : `Tự động (${auto ? voiceLabel(auto).split(' · ')[0] : 'giọng tốt nhất'})`}</option>
              {list.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {voiceLabel(v)}
                </option>
              ))}
            </Select>
          </div>
          <Button icon={Volume2} className="h-12 shrink-0 px-4" onClick={() => void previewVoice(pickVoice(accent), accent)}>
            Nghe thử
          </Button>
        </div>
      )}
      <div>
        <p className="mb-2 text-[0.9375rem] font-medium">Tốc độ giọng máy</p>
        <Segmented
          layoutId="speech-speed"
          value={settings.speechSpeed}
          onChange={(v) => {
            updateSettings({ speechSpeed: v })
            void previewVoice(pickVoice(accent), accent)
          }}
          options={[
            { value: 'slower', label: 'Rất chậm' },
            { value: 'slow', label: 'Chậm' },
            { value: 'normal', label: 'Vừa' },
            { value: 'fast', label: 'Nhanh' },
          ]}
        />
      </div>
      {apple && (
        <>
          <button type="button" onClick={() => setHelp((h) => !h)} className="self-start text-sm font-semibold text-accent">
            {help ? 'Ẩn hướng dẫn' : 'Giọng máy đọc chưa đúng giọng đã chọn?'}
          </button>
          {(help || pinned) && (
            <div className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3 text-[0.8125rem] leading-relaxed text-muted">
              {pinned && (
                <p className="font-semibold text-warning">
                  Đang dùng giọng “{pinned.name}” có sẵn của máy. Chọn “Tự động” để dùng giọng Nâng cao/Cao cấp bạn đã tải.
                </p>
              )}
              {help && (
                <>
                  <p>
                    Cách chắc chắn nhất là <b className="text-text">Giọng iPhone</b> ở trên. Ngoài ra, để <b className="text-text">Tự động</b>, app nhờ iPhone đọc bằng giọng bạn chọn trong{' '}
                    <b className="text-text">Cài đặt → Trợ năng → Nội dung được đọc → Giọng nói → Tiếng Anh</b>, kể cả giọng tải thêm “Nâng cao”, “Cao cấp” (các giọng này không hiện trong danh
                    sách trên vì Apple ẩn chúng với ứng dụng web).
                  </p>
                  <p>
                    Giọng chọn trong Cài đặt phải <b className="text-text">cùng giọng với app</b>: app đang để {accent === 'uk' ? 'Anh–Anh' : 'Anh–Mỹ'} thì chọn giọng{' '}
                    {accent === 'uk' ? 'Anh (Jamie, Serena, Kate, Oliver…)' : 'Mỹ (Evan, Ava, Zoe, Nathan…)'}. Khác giọng thì iPhone đọc bằng giọng mặc định{' '}
                    {accent === 'uk' ? 'Daniel' : 'Samantha'}.
                  </p>
                  <p>Lưu ý: iOS 26 có lỗi đôi khi bỏ qua giọng đã chọn và vẫn đọc bằng giọng mặc định (đã có người báo Apple, chưa được sửa), hay gặp khi mở app từ màn hình chính.</p>
                  <p>Đổi giọng trong Cài đặt xong, tắt hẳn app (vuốt lên khỏi màn đa nhiệm) rồi mở lại và bấm “Nghe thử”.</p>
                  <p>Muốn cả từ vựng cũng đọc bằng giọng này thì tắt “Ưu tiên giọng người thật”.</p>
                </>
              )}
            </div>
          )}
        </>
      )}
      {!apple && (
        <>
          <button type="button" onClick={() => setHelp((h) => !h)} className="self-start text-sm font-semibold text-accent">
            {help ? 'Ẩn hướng dẫn' : 'Giọng máy nghe chưa hay? Tải giọng chất lượng cao'}
          </button>
          {help && (
            <div className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3 text-[0.8125rem] leading-relaxed text-muted">
              <p>
                <b className="text-text">Android:</b> Cài đặt → Hệ thống → Ngôn ngữ → Đầu ra chuyển văn bản thành lời nói → Dịch vụ của Google → Cài đặt → Cài đặt dữ liệu giọng nói → Tiếng Anh (Mỹ/Vương
                quốc Anh) → tải giọng chất lượng cao. Sau đó tắt hẳn trình duyệt rồi mở lại app.
              </p>
              <p>
                <b className="text-text">Máy tính:</b> Chrome có sẵn giọng “Google US English / UK English”; Edge có giọng “Online (Natural)” rất tự nhiên.
              </p>
              <p>
                <b className="text-text">iPhone/iPad:</b> Apple không cho ứng dụng web dùng giọng tải thêm, chỉ dùng được giọng có sẵn của máy.
              </p>
            </div>
          )}
        </>
      )}
      <p className="text-[0.6875rem] leading-relaxed text-subtle">Bản ghi phát âm: Wiktionary / Wikimedia Commons, giấy phép CC BY-SA, CC BY hoặc phạm vi công cộng.</p>
    </div>
  )
}

// ---- Giao diện và âm thanh ----------------------------------------------------------------------

export function AppearancePage() {
  const settings = useSettings()
  return (
    <Page title="Giao diện và âm thanh" subtitle="Chỉ áp dụng trên máy này" back={<BackButton fallback="/me" />}>
      <Card>
        <p className="mb-2 text-[0.9375rem] font-medium">Giao diện</p>
        <Segmented
          layoutId="theme"
          value={settings.theme}
          onChange={(v) => updateSettings({ theme: v })}
          options={[
            { value: 'system', label: 'Theo máy' },
            { value: 'light', label: 'Sáng' },
            { value: 'dark', label: 'Tối' },
          ]}
        />
        <p className="mt-4 mb-2 text-[0.9375rem] font-medium">Cỡ chữ</p>
        <Segmented
          layoutId="text-size"
          value={settings.textSize}
          onChange={(v) => updateSettings({ textSize: v })}
          options={[
            { value: 'small', label: 'Nhỏ' },
            { value: 'normal', label: 'Vừa' },
            { value: 'large', label: 'Lớn' },
            { value: 'larger', label: 'Rất lớn' },
          ]}
        />
        <p className="mt-2 text-[0.8125rem] leading-snug text-muted">Phóng to cả chữ lẫn nút trong app. Cỡ chữ đặt trong Cài đặt của iPhone không áp cho app này.</p>
        <SettingRow title="Giảm hiệu ứng" description="Tắt chuyển động trượt, lật thẻ và pháo giấy.">
          <Switch label="Giảm hiệu ứng" checked={settings.reduceMotion} onChange={(v) => updateSettings({ reduceMotion: v })} />
        </SettingRow>
      </Card>
      <Card>
        <SettingRow title="Âm thanh hiệu ứng" description="Tiếng báo đúng, gần đúng, sai, lưu xong, AI trả lời, hoàn thành buổi học, đạt huy hiệu.">
          <Switch label="Âm thanh hiệu ứng" checked={settings.soundEffects} onChange={(v) => updateSettings({ soundEffects: v })} />
        </SettingRow>
        {settings.soundEffects && (
          <>
            <SettingRow title="Tiếng chạm nút" description="Tiếng nhẹ khi chạm nút, chuyển tab, bật tắt, mở bảng, lật thẻ.">
              <Switch label="Tiếng chạm nút" checked={settings.tapSounds} onChange={(v) => updateSettings({ tapSounds: v })} />
            </SettingRow>
            <button type="button" data-sfx="none" onClick={playDemo} className="inline-flex items-center gap-1.5 py-1 text-sm font-semibold text-accent">
              <Volume2 aria-hidden className="h-4 w-4" /> Nghe thử một lượt
            </button>
          </>
        )}
      </Card>
    </Page>
  )
}
