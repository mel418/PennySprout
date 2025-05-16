// src/components/Upload.jsx
import { useState } from "react";
import { useNavigate } from 'react-router-dom';

export default function Upload({ setLoading, loading, setParsedData }) {
    const [files, setFiles] = useState([]);
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFiles(e.dataTransfer.files);
        }
    };

    const handleChange = (e) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            handleFiles(e.target.files);
        }
    };

    const handleFiles = (fileList) => {
        const newFiles = Array.from(fileList).filter(file =>
            file.type === 'application/pdf'
        );

        if (newFiles.length === 0) {
            setError("Please upload PDF files only");
            return;
        }

        setError(null);
        setFiles(prevFiles => [...prevFiles, ...newFiles]);
    };

    const removeFile = (index) => {
        setFiles(files.filter((_, i) => i !== index));
    };

    const uploadFiles = async () => {
        if (files.length === 0) {
            setError("Please add at least one file");
            return;
        }

        setLoading(true);
        setError(null);

        const formData = new FormData();
        files.forEach(file => {
            formData.append('files', file);
        });

        try {
            // replace with your actual API endpoint
            const response = await fetch('http://localhost:5000/api/parse-statements', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Failed to parse statements');
            }

            const data = await response.json();
            setParsedData(data);
            navigate('/dashboard');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center">Upload Bank Statements</h1>
      
      <div 
        className={`border-2 border-dashed rounded-lg p-8 mb-6 text-center
          ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <svg 
          className="mx-auto h-12 w-12 text-gray-400" 
          stroke="currentColor" 
          fill="none" 
          viewBox="0 0 48 48" 
          aria-hidden="true"
        >
          <path 
            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" 
            strokeWidth={2} 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
        </svg>
        <p className="mt-2 text-sm text-gray-600">
          Drag and drop your bank statement PDFs, or{' '}
          <label 
            htmlFor="file-upload" 
            className="relative cursor-pointer text-blue-600 hover:text-blue-500 focus-within:outline-none"
          >
            <span>browse to upload</span>
            <input
              id="file-upload"
              name="file-upload"
              type="file"
              accept=".pdf"
              className="sr-only"
              onChange={handleChange}
              multiple
            />
          </label>
        </p>
        <p className="mt-1 text-xs text-gray-500">PDF files only (max 10MB)</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {files.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-medium mb-2">Files to upload:</h2>
          <ul className="divide-y divide-gray-200 border rounded-md">
            {files.map((file, index) => (
              <li key={index} className="flex items-center justify-between py-3 px-4">
                <div className="flex items-center">
                  <svg 
                    className="h-6 w-6 text-red-500 mr-3" 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path 
                      fillRule="evenodd" 
                      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" 
                      clipRule="evenodd" 
                    />
                  </svg>
                  <span className="truncate max-w-xs">{file.name}</span>
                </div>
                <button 
                  type="button"
                  onClick={() => removeFile(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-center">
        <button
          onClick={uploadFiles}
          disabled={loading}
          className={`px-6 py-2 rounded-md ${
            loading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {loading ? 'Processing...' : 'Analyze Statements'}
        </button>
      </div>
    </div>
  );
}