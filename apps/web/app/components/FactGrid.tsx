// Module: app/components/FactGrid.tsx
// Defines component(s)/export(s): StepGrid, BulletGrid
//
//

export function StepGrid({ steps }: {
    steps: { name: string; text: string }[];
}) {
    return (<div className={`fact-grid ${steps.length >= 3 ? 'fact-grid-3' : ''}`}>
      {steps.map((step, index) => (<div key={step.name} className="panel fact-box">
          <span className="fact-box-num" aria-hidden="true">{index + 1}</span>
          <p className="font-medium">{step.name}</p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{step.text}</p>
        </div>))}
    </div>);
}

export function BulletGrid({ items }: {
    items: string[];
}) {
    return (<div className={`fact-grid ${items.length >= 3 ? 'fact-grid-3' : ''}`}>
      {items.map((item) => (<div key={item} className="panel fact-box">
          <span className="fact-box-dot" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </span>
          <p className="text-sm leading-relaxed">{item}</p>
        </div>))}
    </div>);
}
