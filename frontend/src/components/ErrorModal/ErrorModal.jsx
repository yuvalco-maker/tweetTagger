
import './ErrorModal.css';

function ErrorModal({ message, onClose }) {
  if (!message) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <strong>Error:</strong>
        <span>{message}</span>
        <button 
          onClick={onClose}
          style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid', cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default ErrorModal;