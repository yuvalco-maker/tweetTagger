import React, { useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';
import Input from '../../components/Input/Input.jsx';
import Button from '../../components/Button/Button.jsx';
import ErrorModal from '../../components/ErrorModal/ErrorModal.jsx';
import ThemeToggle from "../../components/ThemeToggle/ThemeToggle.jsx";
import styles from './register.module.css';

export default function RegisterPage() {
  // Removed the "function App() {" line - everything stays inside RegisterPage
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  const triggerError = (msg) => {
    setErrorMessage(msg);
    setShowError(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAction = async () => {
    const serverUrl = import.meta.env.VITE_SERVER_URL || "https://em5epzymak.eu-west-3.awsapprunner.com";
    const url = `${serverUrl}/auth/register`;
     if(!formData.password){
        const error = "please fill in you'r passowrd"
        triggerError(error)
        return
      }
      if(!formData.username){
        const error = "please fill in you'r username"
        triggerError(error)
        return
      }
      if(!formData.email){
        const error = "please fill in you'r email adress"
        triggerError(error)
        return
      }
      
    

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();

      if (response.ok) {
        alert("Registration Successful!");
        navigate("/login")

      } else {
        triggerError(data.detail || "Registration failed.");
      }
    } catch (err) {
      triggerError("Could not connect to the server.");
    }
  };

 return (
    <div className="app-wrapper">
      {/* Fixed: changed z-index to zIndex */}
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 2000 }}>
        <ThemeToggle />
      </div>

      <div className={styles['register-card']}>
        <header className={styles['login-header']}>Register</header>
        <form onSubmit={(e) => { e.preventDefault(); handleAction(); }}>
          <Input 
            className={styles['username-input']} 
            name="username" 
            value={formData.username}
            placeholder="Username"
            onChange={handleChange}
          />

          <Input
            className={styles['email-input']}
            name="email"
            value={formData.email}
            placeholder="Email@email.com"
            onChange={handleChange}
          />

          <Input 
            className={styles['password-input']} 
            name="password" 
            type="password" 
            value={formData.password} 
            placeholder="Password" 
            onChange={handleChange} 
          />
          
          <div className={styles['footer-text']}>
            Already have an account? 
            <Link to="/login" className={styles['signin-link']}>Sign in</Link>
          </div>

          <Button 
            className={styles['btn-reg']} 
            type="submit" 
            variant="primary"
          >
            Register
          </Button>
        </form>
      </div>
      {showError && <ErrorModal message={errorMessage} onClose={() => setShowError(false)} />}
    </div>
  );
} // Only one closing bracket here!