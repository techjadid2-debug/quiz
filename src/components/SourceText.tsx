export function SourceText({ source }: { source: string }) {
  if (/^https?:\/\//i.test(source)) {
    return (
      <a
        href={source}
        target="_blank"
        rel="noopener noreferrer"
        className="break-words text-accent underline underline-offset-2 hover:opacity-80"
      >
        {source}
        <span className="sr-only"> (yangi oynada ochiladi)</span>
      </a>
    );
  }
  return <span className="break-words">{source}</span>;
}
