/* Input.jsx */
import './Input.css';

const Input = ({ onChange, name, value, className, ...props }) => {
  return (
    /* This className is what connects to "username-input" etc. in your CSS */
    <div className={`input-wrapper ${className}`}>
      <input 
        name={name}
        value={value}
        onChange={onChange}
        {...props}
      />
    </div>
  );
};
export default Input;