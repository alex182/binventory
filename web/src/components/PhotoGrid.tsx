import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Photo, deletePhoto, listPhotos, photoThumbUrl, photoUrl, uploadPhoto } from "../api";

interface Props {
  binId: number;
}

export default function PhotoGrid({ binId }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function refresh() {
    listPhotos(binId).then(setPhotos);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binId]);

  useEffect(() => {
    if (!viewingPhoto) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setViewingPhoto(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewingPhoto]);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadPhoto(binId, file);
    if (inputRef.current) inputRef.current.value = "";
    refresh();
  }

  async function handleDelete(id: number) {
    await deletePhoto(id);
    if (viewingPhoto?.id === id) setViewingPhoto(null);
    refresh();
  }

  return (
    <div className="photo-grid-section">
      <h3>Photos</h3>
      <div className="photo-grid">
        {photos.map((photo) => (
          <div className="photo-thumb" key={photo.id}>
            <img
              src={photoThumbUrl(photo.id)}
              alt=""
              onClick={() => setViewingPhoto(photo)}
            />
            <button onClick={() => handleDelete(photo.id)}>Delete</button>
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
      />
      {viewingPhoto && (
        <div className="photo-lightbox" onClick={() => setViewingPhoto(null)}>
          <img src={photoUrl(viewingPhoto.id)} alt="" onClick={(e) => e.stopPropagation()} />
          <button className="photo-lightbox-close" onClick={() => setViewingPhoto(null)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
