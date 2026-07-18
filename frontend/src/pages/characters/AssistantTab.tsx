import { Cloud } from 'lucide-react';
import { BuildScenarioLab } from '../../components/BuildScenarioLab';
import { GeminiCoach } from '../../components/GeminiCoach';
import type { CharacterActionPlan, ProfileDiagnostic, ReconciliationResult } from '../../types';

export function AssistantTab({
  selectedId,
  poeConnectionId,
  previewReconciliation,
  applyReconciliation,
  reconciliation,
  actionPlan,
  profileDiagnostics,
  onAskGemini,
  characterId,
  geminiContext,
  onGeminiAction,
}: {
  selectedId: number | null;
  poeConnectionId: number | null;
  previewReconciliation: (connectionId: number) => void;
  applyReconciliation: (connectionId: number) => void;
  reconciliation: ReconciliationResult | null;
  actionPlan: CharacterActionPlan | null;
  profileDiagnostics: ProfileDiagnostic[];
  onAskGemini: (prompt: string) => void;
  characterId: number;
  geminiContext: Record<string, unknown>;
  onGeminiAction: (action: { action: string; slot?: string }) => void;
}) {
  return (
    <>
      {selectedId && poeConnectionId != null && (
        <section className="card build-card" data-tab-group="assistant">
          <div className="build-section-title">
            <Cloud />
            <div>
              <h2>Official account reconciliation</h2>
              <p>Preview differences first; applying always requires a second confirmation.</p>
            </div>
          </div>
          <button type="button" onClick={() => previewReconciliation(poeConnectionId)}>
            Compare with PoE account
          </button>
          {reconciliation && (
            <>
              <div className="review-list">
                {reconciliation.differences.map((diff) => (
                  <article key={diff.slot}>
                    <div>
                      <strong>
                        {diff.slot} · {diff.status}
                      </strong>
                      <small>Local and official equipment differ.</small>
                    </div>
                  </article>
                ))}
              </div>
              {reconciliation.requiresConfirmation && (
                <button className="primary-button" type="button" onClick={() => applyReconciliation(poeConnectionId)}>
                  Confirm official reconciliation
                </button>
              )}
            </>
          )}
        </section>
      )}

      <div data-tab-group="assistant">
        <BuildScenarioLab plan={actionPlan} diagnostics={profileDiagnostics} onAskGemini={onAskGemini} />
      </div>

      <div data-tab-group="assistant">
        <GeminiCoach mode="build" characterId={characterId} context={geminiContext} onAction={onGeminiAction} />
      </div>
    </>
  );
}
