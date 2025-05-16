# PennySprout - Bank Statement Parser and Budget Analyzer

A web application that helps you parse bank statements (like the provided Discover credit card and Orange County Credit Union statements), visualize your spending patterns, and get AI-powered budget recommendations.

## Features

- **PDF Statement Parsing**: Upload and parse PDF bank statements to extract transactions
- **Automatic Categorization**: Automatically categorize transactions based on descriptions
- **Dashboard Visualization**: View spending trends, account balances, and recent transactions
- **Transaction Management**: View, search, filter, and sort all your transactions
- **Budget Planning**: Set budgets for different categories and track your progress
- **Financial Insights**: Receive AI-powered insights and recommendations about your finances

## Tech Stack

### Frontend
- React.js with Vite
- React Router for navigation
- Recharts for data visualization
- Tailwind CSS for styling

### Backend
- Flask API for processing bank statements
- PyPDF2 for PDF parsing
- Scikit-learn for transaction categorization
- Flask-CORS for cross-origin requests

## Getting Started

### Prerequisites
- Node.js and npm
- Python 3.7+
- pip

### Installation

1. Clone the repository
```bash
git clone https://github.com/your-username/finance-ai.git
cd PennySprout
```

2. Set up the backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. Set up the frontend
```bash
cd ../frontend
npm install
```

### Folder Structure
```bash
PennySprout/
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   └── uploads/ (created automatically)
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Dashboard.jsx
    │   │   ├── Upload.jsx
    │   │   ├── Transactions.jsx
    │   │   ├── Budget.jsx
    │   │   ├── Insights.jsx
    │   │   └── Navbar.jsx
    │   ├── App.jsx
    │   ├── main.jsx
    │   ├── index.css
    │   └── App.css
    ├── index.html
    ├── package.json
    ├── tailwind.config.js
    └── vite.config.js
```

### Running the Application

1. Start the backend server
```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
python app.py
```

2. Start the frontend development server
```bash
cd frontend
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

## Usage

1. **Upload Statements**: Go to the Upload page and upload your bank statements (PDF format)
2. **View Dashboard**: Check your financial overview on the Dashboard
3. **Explore Transactions**: View and filter all your transactions
4. **Set Budgets**: Create and manage category budgets
5. **Get Insights**: Receive AI-powered financial insights and recommendations

## Supported Banks

Currently, the application supports the following bank statement formats:
- Discover Credit Card statements
- Orange County Credit Union statements

Support for additional banks can be added by extending the parsing rules in the backend.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [React.js](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [Flask](https://flask.palletsprojects.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Recharts](https://recharts.org/)
- [PyPDF2](https://pypdf2.readthedocs.io/)
- [Scikit-learn](https://scikit-learn.org/)
