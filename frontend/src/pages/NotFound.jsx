import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold">That page doesn't exist</h1>
      <p className="mt-2 text-muted">The link may be old or mistyped.</p>
      <Link to="/" className="btn btn-secondary mt-4">Back to the start</Link>
    </div>
  );
}
