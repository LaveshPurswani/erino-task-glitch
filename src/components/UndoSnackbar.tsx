import { Snackbar, Button } from '@mui/material';

interface Props {
  open: boolean;
  onClose: () => void;
  onUndo: () => void;
}

export default function UndoSnackbar({ open, onClose, onUndo }: Props) {
  return (
    <Snackbar
      open={open}
      onClose={onClose}
      // ! bug identified by me --> sometimes deleting or undoing delete a tasks causes duplication of tasks data in the UI table.
      // ! bug identifies by me --> sometime after deleting certain tasks, there is duplication of a specific task item in the table UI. so far i have noticed ony Prospect outreach #1 task item to be duplicating.
      autoHideDuration={4000}
      message="Task deleted"
      action={<Button color="secondary" size="small" onClick={onUndo}>Undo</Button>}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    />
  );
}


