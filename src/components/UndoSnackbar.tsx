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
      // ! bug identified by me --> snackbar does not closes after the duration. check auto hide functionality
      // ! bug identified by me --> sometimes deleting or undoing delete a tasks causes duplication of tasks data in the UI table.
      autoHideDuration={4000} // ! change value to 4000 after testing
      message="Task deleted"
      action={<Button color="secondary" size="small" onClick={onUndo}>Undo</Button>}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    />
  );
}


