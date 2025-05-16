// src/components/Dashboard.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

export default function Dashboard({ parsedData }) {
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netCashflow: 0,
    spendingByCategory: [],
    balances: [],
    recentTransactions: []
  });
  const navigate = useNavigate();

  // COLORS for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];

  useEffect(() => {
    if (!parsedData) {
      // If no data is loaded, redirect to upload page
      navigate('/upload');
      return;
    }

    // Process data for dashboard
    if (parsedData.transactions) {
      const transactions = parsedData.transactions;
      
      // Calculate income, expenses, and net cashflow
      const income = transactions
        .filter(t => parseFloat(t.amount) > 0)
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        
      const expenses = transactions
        .filter(t => parseFloat(t.amount) < 0)
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
        
      // Calculate spending by category
      const categoryMap = {};
      transactions
        .filter(t => parseFloat(t.amount) < 0)
        .forEach(t => {
          const category = t.category || 'Uncategorized';
          categoryMap[category] = (categoryMap[category] || 0) + Math.abs(parseFloat(t.amount));
        });
        
      const spendingByCategory = Object.entries(categoryMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
      
      // Get account balances
      const accountMap = {};
      transactions.forEach(t => {
        if (!accountMap[t.account]) {
          accountMap[t.account] = 0;
        }
        accountMap[t.account] += parseFloat(t.amount);
      });
      
      const balances = Object.entries(accountMap)
        .map(([name, value]) => ({ name, value }));
      
      // Get recent transactions
      const recentTransactions = [...transactions]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);
      
      setSummary({
        totalIncome: income,
        totalExpenses: expenses,
        netCashflow: income - expenses,
        spendingByCategory,
        balances,
        recentTransactions
      });
    }
  }, [parsedData, navigate]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Function to determine transaction color based on amount
  const getAmountColor = (amount) => {
    return amount < 0 ? 'text-red-600' : amount > 0 ? 'text-green-600' : 'text-gray-700';
  };

  // Custom tooltip for pie chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 shadow-md rounded-md border border-gray-200">
          <p className="font-medium">{payload[0].name}</p>
          <p className="text-gray-700">{formatCurrency(payload[0].value)}</p>
          <p className="text-gray-500 text-sm">
            {((payload[0].value / summary.totalExpenses) * 100).toFixed(1)}% of total
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Financial Dashboard</h1>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-medium mb-2 text-gray-700">Income</h2>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalIncome)}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-medium mb-2 text-gray-700">Expenses</h2>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalExpenses)}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-medium mb-2 text-gray-700">Net Cashflow</h2>
          <p className={`text-2xl font-bold ${summary.netCashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(summary.netCashflow)}
          </p>
        </div>
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Spending by Category */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-medium mb-4 text-gray-700">Spending by Category</h2>
          {summary.spendingByCategory.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary.spendingByCategory}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {summary.spendingByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No spending data available</p>
          )}
        </div>
        
        {/* Account Balances */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-medium mb-4 text-gray-700">Account Balances</h2>
          {summary.balances.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.balances}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis 
                    tickFormatter={tick => new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(tick)} 
                  />
                  <Tooltip 
                    formatter={value => formatCurrency(value)}
                    labelFormatter={label => `Account: ${label}`}
                  />
                  <Legend />
                  <Bar dataKey="value" fill="#8884d8" name="Balance">
                    {summary.balances.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#00C49F' : '#FF8042'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No account balance data available</p>
          )}
        </div>
      </div>
      
      {/* Recent Transactions */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-700">Recent Transactions</h2>
          <button 
            onClick={() => navigate('/transactions')}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            View All
          </button>
        </div>
        
        {summary.recentTransactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {summary.recentTransactions.map((transaction, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(transaction.date)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                      {transaction.description}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                      {transaction.category || 'Uncategorized'}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                      {transaction.account}
                    </td>
                    <td className={`px-4 py-2 whitespace-nowrap text-sm text-right font-medium ${getAmountColor(transaction.amount)}`}>
                      {formatCurrency(transaction.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No recent transactions</p>
        )}
      </div>
    </div>
  );
}