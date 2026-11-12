import Button from "./ActionButton.jsx";

export default function GalleryOrder({ ids = [], onChange }) {
  function move(index, delta) {
    const next = [...ids],
      target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }
  return (
    <ol className="gallery-order" aria-label="Gallery image order">
      {ids.map((id, index) => (
        <li key={id}>
          <span>
            Image {index + 1} <code>{id}</code>
          </span>
          <div className="editor-actions">
            <Button
              type="button"
              icon="back"
              disabled={index === 0}
              aria-label={`Move gallery image ${index + 1} earlier`}
              onClick={() => move(index, -1)}
            >
              Earlier
            </Button>
            <Button
              type="button"
              disabled={index === ids.length - 1}
              aria-label={`Move gallery image ${index + 1} later`}
              onClick={() => move(index, 1)}
            >
              Later
            </Button>
            <Button
              type="button"
              aria-label={`Remove gallery image ${index + 1}`}
              onClick={() => onChange(ids.filter((value) => value !== id))}
            >
              Remove
            </Button>
          </div>
        </li>
      ))}
    </ol>
  );
}
