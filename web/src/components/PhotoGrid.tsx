import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Photo, deletePhoto, listPhotos, photoThumbUrl, uploadPhoto } from "../api";

interface Props {
  binId: number;
}

export default function PhotoGrid({ binId }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function refresh() {
    listPhotos(binId).then(setPhotos);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binId]);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadPhoto(binId, file);
    if (inputRef.current) inputRef.current.value = "";
    refresh();
  }

  async function handleDelete(id: number) {
    await deletePhoto(id);
    refresh();
  }

  return (
    <div className="photo-grid-section">
      <h3>Photos</h3>
      <div className="photo-grid">
        {photos.map((photo) => (
          <div className="photo-thumb" key={photo.id}>
            <img src={photoThumbUrl(photo.id)} alt="" />
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
    </div>
  );
}
