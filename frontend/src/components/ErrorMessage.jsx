export default function ErrorMessage({ error, onRetry }) {
  if (!error) return null;
  const message = typeof error === 'string' ? error : error.message;
  return (
    <div className="alert alert-error">
      {message}
      {onRetry && (
        <>
          {' '}
          <button className="btn-link" onClick={onRetry}>
            Reintentar
          </button>
        </>
      )}
    </div>
  );
}
