// src/App.jsx
import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Upload from './components/Upload';
import Transactions from './components/Transactions';
import Budget from './components/Budget';
import Insights from './components/Insights';
import Navbar from './components/Navbar';
import './App.css';

function App() {
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState(null);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Dashboard parsedData={parsedData} />} />
          <Route 
            path="/upload" 
            element={
              <Upload 
                setLoading={setLoading} 
                loading={loading}
                setParsedData={setParsedData} 
              />
            } 
          />
          <Route 
            path="/transactions" 
            element={<Transactions parsedData={parsedData} />} 
          />
          <Route 
            path="/budget" 
            element={<Budget parsedData={parsedData} />} 
          />
          <Route 
            path="/insights" 
            element={<Insights parsedData={parsedData} />} 
          />
        </Routes>
      </div>
    </div>
  );
}

export default App;