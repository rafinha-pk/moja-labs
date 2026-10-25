import { setupApi } from '../../../api';
import type { SetupStep } from '../../../api/types';
import { useAction } from '../../../api/useAction';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { ErrorAlert } from '../../../components/ErrorAlert';
import { pt } from '../../../i18n/pt';

export function CommitStep({
  projectId,
  status,
  canManage,
  onDone,
}: {
  projectId: number;
  status: SetupStep['status'] | undefined;
  canManage: boolean;
  onDone: () => void;
}) {
  const text = pt.setup.wizard.commit;
  const { run, pending, error } = useAction();

  const send = async () => {
    await run(() => setupApi.initialCommit(projectId));
    onDone();
  };

  return (
    <Card title={text.title}>
      <div className="flex flex-col gap-4 p-4">
        <p className="text-sm text-muted">{text.text}</p>
        <ErrorAlert error={error} />
        {status === 'done' && <p className="text-sm">{text.done}</p>}
        {status === 'skipped' && <p className="text-sm">{text.skipped}</p>}
        {status === 'todo' && canManage && (
          <div>
            <Button variant="primary" disabled={pending} onClick={send}>
              {text.send}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
