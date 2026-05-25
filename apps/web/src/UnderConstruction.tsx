// Shown to non-dev/admin accounts when an admin flips the under-construction
// flag (live-testing gate). Dev/admin accounts bypass it (ConstructionGate).
export function UnderConstruction(): JSX.Element {
  return (
    <div className="construction">
      <div className="construction-box">
        <div className="construction-glyph" aria-hidden="true">
          ▚▞▚▞▚
        </div>
        <div className="construction-title">cloud-env.central</div>
        <div className="construction-sub">{'// under construction'}</div>
        <div className="construction-body">
          the cloud is being reconfigured. check back soon, runner.
        </div>
      </div>
    </div>
  );
}
