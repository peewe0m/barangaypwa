import { useState } from 'react';
import { ConfirmDialog } from '../components/ui/confirm-dialog';

export function useConfirmAction() {
  const [options, setOptions] = useState(null);

  const confirm = (nextOptions) => {
    setOptions(nextOptions);
  };

  const confirmDialog = (
    <ConfirmDialog
      open={Boolean(options)}
      onOpenChange={(open) => {
        if (!open) setOptions(null);
      }}
      title={options?.title || 'Confirm action'}
      description={options?.description || 'Please confirm if you want to proceed with this action.'}
      confirmLabel={options?.confirmLabel || 'Confirm'}
      cancelLabel={options?.cancelLabel || 'Cancel'}
      tone={options?.tone || 'danger'}
      onConfirm={async () => {
        const action = options?.onConfirm;
        setOptions(null);
        await action?.();
      }}
    />
  );

  return { confirm, confirmDialog };
}
