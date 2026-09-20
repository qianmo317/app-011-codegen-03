import { useRef } from 'react';
import type { LogPhoto } from '../types';

interface Props {
  photos: LogPhoto[];
  onChange: (photos: LogPhoto[]) => void;
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** 把图片压到最长边 1280px 的 jpeg dataURL，避免体积过大 */
function fileToThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const MAX = 1280;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function PhotoUpload({ photos, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const added: LogPhoto[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const dataUrl = await fileToThumbnail(file);
      added.push({ id: genId(), dataUrl, caption: '' });
    }
    onChange([...photos, ...added]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const updateCaption = (id: string, caption: string) =>
    onChange(photos.map((p) => (p.id === id ? { ...p, caption } : p)));

  const removePhoto = (id: string) => onChange(photos.filter((p) => p.id !== id));

  return (
    <div className="form-group">
      <label>现场照片（说明这张照片证明了什么）</label>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        style={{ marginBottom: 8 }}
      />
      {photos.length > 0 && (
        <div className="photo-grid">
          {photos.map((p) => (
            <div key={p.id} className="photo-item">
              <img src={p.dataUrl} alt={p.caption || '现场照片'} />
              <input
                type="text"
                placeholder="照片说明，如：闭水试验 48 小时无渗漏"
                value={p.caption}
                onChange={(e) => updateCaption(p.id, e.target.value)}
              />
              <button
                type="button"
                className="btn btn-danger photo-del"
                onClick={() => removePhoto(p.id)}
              >
                删除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
