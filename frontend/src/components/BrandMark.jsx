/** Geographic-pin logo mark, reused in the header and the login screen. */
export default function BrandMark({ size = 22 }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 26 34"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M13 0C5.8 0 0 5.8 0 13c0 9.2 11.5 20 12 20.5.3.3.7.3 1 0 .5-.5 12-11.3 12-20.5C25 5.8 19.2 0 13 0z"
        fill="var(--primary)"
      />
      <circle cx="13" cy="13" r="5.5" fill="var(--accent)" />
    </svg>
  );
}
