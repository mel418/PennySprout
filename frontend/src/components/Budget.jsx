// src/components/Budget.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

export default function Budget({ parsedData }) {
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [editingCategory, setEditingCategory] = useState('');
  const [newBudgetAmount, setNewBudgetAmount] = useState('');
  const [spendingData, setSpendingData] = useState([]);
  const [totalBudget, setTotalBudget] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const navigate = useNavigate();

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];
  
  useEffect(() => {
    if (!parsedData) {
      // If no data is loaded, redirect to upload page
      navigate('/upload');
      return;
    }

    // Load existing budgets from localStorage
    const savedBudgets = localStorage.getItem('budgets');
    if (savedBudgets) {
      setBudgets(JSON.parse(savedBudgets));
    }

    if (parsedData.transactions) {
      // Extract categories from transactions
      const uniqueCategories = [...new Set(
        parsedData.transactions
          .filter(t => t.category)
          .map(t => t.category)
      )];
      
      // Add 'Uncategorized' for transactions without a category
      if (parsedData.transactions.some(t => !t.category)) {
        uniqueCategories.push('Uncategorized');
      }
      
      setCategories(uniqueCategories.sort());
      
      // Calculate spending by category
      const spending = {};
      parsedData.transactions
        .filter(t => parseFloat(t.amount) < 0) // Only consider expenses
        .forEach(t => {
          const category = t.category || 'Uncategorized';
          spending[category] = (spending[category] || 0) + Math.abs(parseFloat(t.amount));
        });
      
      // Update total spent
      const totalSpentAmount = Object.values(spending).reduce((sum, amount) => sum + amount, 0);
      setTotalSpent(totalSpentAmount);
      
      // Create data for chart
      const spendingWithBudgets = Object.keys(spending).map(category => {
        return {
          name: category,
          spent: spending[category],
          budget: (budgets[category] || 0),
        };
      });
      
      setSpendingData(spendingWithBudgets);
      
      // Update total budget
      if (savedBudgets) {
        const parsedBudgets = JSON.parse(savedBudgets);
        const totalBudgetAmount = Object.values(parsedBudgets).reduce(
          (sum, amount) => sum + parseFloat(amount || 0), 
          0
        );
        setTotalBudget(totalBudgetAmount);
      }
    }
  }, [parsedData, navigate]);

  // Update the chart when budgets change
  useEffect(() => {
    if (Object.keys(budgets).length > 0 && spendingData.length > 0) {
      // Update spending data with new budgets
      const updatedSpendingData = spendingData.map(item => ({
        ...item,
        budget: budgets[item.name] || 0,
      }));
      
      setSpendingData(updatedSpendingData);
      
      // Update total budget
      const totalBudgetAmount = Object.values(budgets).reduce(
        (sum, amount) => sum + parseFloat(amount || 0), 
        0
      );
      setTotalBudget(totalBudgetAmount);
      
      // Save budgets to localStorage
      localStorage.setItem('budgets', JSON.stringify(budgets));
    }
  }, [budgets, spendingData]);

  const handleEditBudget = (category) => {
    setEditingCategory(category);
    setNewBudgetAmount(budgets[category] || '');
  };

  const handleSaveBudget = () => {
    if (editingCategory && !isNaN(parseFloat(newBudgetAmount))) {
      setBudgets({
        ...budgets,
        [editingCategory]: parseFloat(newBudgetAmount),
      });
      setEditingCategory('');
      setNewBudgetAmount('');
    }
  };

  const handleCancelEdit = () => {
    setEditingCategory('');
    setNewBudgetAmount('');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Calculate budget progress and status
  const getBudgetStatus = (spent, budget) => {
    if (!budget) return 'No budget set';
    
    const percentUsed = (spent / budget) * 100;
    
    if (percentUsed > 100) {
      return 'Over budget';
    } else if (percentUsed > 80) {
      return 'Near limit';
    } else {
      return 'On track';
    }
  };

  // Get color based on budget status
  const getStatusColor = (status) => {
    switch (status) {
      case 'Over budget':
        return 'bg-red-100 text-red-800';
      case 'Near limit':
        return 'bg-yellow-100 text-yellow-800';
      case 'On track':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Calculate percent of budget used
  const getPercentUsed = (spent, budget) => {
    if (!budget) return 0;
    return Math.min(100, Math.round((spent / budget) * 100));
  };

  // Custom tooltip for the budget vs spending chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 shadow-md rounded-md border border-gray-200">
          <p className="font-medium">{data.name}</p>
          <p className="text-red-600">Spent: {formatCurrency(data.spent)}</p>
          <p className="text-blue-600">Budget: {formatCurrency(data.budget || 0)}</p>
          {data.budget > 0 && (
            <p className={`text-sm ${data.spent > data.budget ? 'text-red-600' : 'text-green-600'}`}>
              {data.spent > data.budget 
                ? `Over by ${formatCurrency(data.spent - data.budget)}` 
                : `Under by ${formatCurrency(data.budget - data.spent)}`}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Generate AI budget recommendations
  const generateRecommendations = () => {
    // Get categories with no budget or over budget
    const categoriesNeedingAttention = spendingData
      .filter(item => !item.budget || item.spent > item.budget)
      .map(item => {
        const status = !item.budget 
          ? 'needs budget' 
          : `over budget by ${formatCurrency(item.spent - item.budget)}`;
        
        return {
          category: item.name,
          spent: item.spent,
          status
        };
      });
    
    // Calculate suggested budget based on spending patterns
    const suggestedBudgets = spendingData.map(item => {
      // If no budget set, suggest 10% more than current spending
      // If over budget, suggest 5% more than current spending
      // If under budget but over 80% used, keep current budget
      // If under 80% used, suggest reducing budget to match actual spending with 20% buffer
      
      let suggestedBudget = item.budget || 0;
      
      if (!item.budget) {
        suggestedBudget = item.spent * 1.1; // 10% more than current spending
      } else if (item.spent > item.budget) {
        suggestedBudget = item.spent * 1.05; // 5% more than current spending
      } else if (item.spent / item.budget > 0.8) {
        suggestedBudget = item.budget; // Keep current budget if near limit
      } else {
        suggestedBudget = item.spent * 1.2; // 20% buffer above actual spending
      }
      
      return {
        category: item.name,
        currentBudget: item.budget || 0,
        spent: item.spent,
        suggestedBudget: Math.round(suggestedBudget * 100) / 100
      };
    });
    
    return {
      needsAttention: categoriesNeedingAttention,
      suggestions: suggestedBudgets,
      general: {
        totalSpent,
        totalBudget,
        status: totalSpent > totalBudget ? 'over budget' : 'under budget',
        difference: Math.abs(totalBudget - totalSpent)
      }
    };
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Budget Planner</h1>
      
      {/* Budget Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-medium mb-2 text-gray-700">Total Budget</h2>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalBudget)}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-medium mb-2 text-gray-700">Total Spent</h2>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalSpent)}</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-medium mb-2 text-gray-700">Remaining</h2>
          <p className={`text-2xl font-bold ${totalBudget - totalSpent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totalBudget - totalSpent)}
          </p>
        </div>
      </div>
      
      {/* Budget vs Spending Chart */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-medium mb-4 text-gray-700">Budget vs Spending</h2>
        {spendingData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={spendingData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={1}
                  dataKey="spent"
                >
                  {spendingData.map((entry, index) => (
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
      
      {/* Budget Management */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-medium mb-4 text-gray-700">Category Budgets</h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Spent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Budget
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {spendingData.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                    {formatCurrency(item.spent)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                    {editingCategory === item.name ? (
                      <input
                        type="number"
                        className="w-24 px-2 py-1 border rounded-md"
                        value={newBudgetAmount}
                        onChange={(e) => setNewBudgetAmount(e.target.value)}
                        step="0.01"
                        min="0"
                      />
                    ) : (
                      formatCurrency(item.budget || 0)
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      getStatusColor(getBudgetStatus(item.spent, item.budget))
                    }`}>
                      {getBudgetStatus(item.spent, item.budget)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.budget ? (
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className={`h-2.5 rounded-full ${
                            item.spent > item.budget ? 'bg-red-600' : 'bg-green-600'
                          }`}
                          style={{ width: `${getPercentUsed(item.spent, item.budget)}%` }}
                        ></div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">No budget set</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    {editingCategory === item.name ? (
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={handleSaveBudget}
                          className="text-green-600 hover:text-green-800"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="text-red-600 hover:text-red-800"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEditBudget(item.name)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* AI Budget Recommendations */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-medium mb-4 text-gray-700">AI Budget Recommendations</h2>
        
        {spendingData.length > 0 ? (
          <div>
            {(() => {
              const recommendations = generateRecommendations();
              
              return (
                <>
                  <div className="mb-4 p-4 bg-blue-50 rounded-md">
                    <h3 className="font-medium text-blue-800 mb-2">Overall Budget Status</h3>
                    <p className="text-gray-700">
                      You are currently{' '}
                      <span className={recommendations.general.status === 'over budget' ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                        {recommendations.general.status}
                      </span>{' '}
                      by {formatCurrency(recommendations.general.difference)}.
                    </p>
                    
                    {recommendations.general.status === 'over budget' ? (
                      <p className="mt-2 text-gray-700">
                        Consider increasing your budget or finding ways to reduce expenses in the categories mentioned below.
                      </p>
                    ) : (
                      <p className="mt-2 text-gray-700">
                        You're doing well with your budget! You might consider saving the extra money or reallocating some budget to categories that need it.
                      </p>
                    )}
                  </div>
                  
                  {recommendations.needsAttention.length > 0 && (
                    <div className="mb-4">
                      <h3 className="font-medium text-gray-700 mb-2">Categories Needing Attention</h3>
                      <ul className="space-y-2">
                        {recommendations.needsAttention.map((category, index) => (
                          <li key={index} className="p-3 bg-yellow-50 rounded-md">
                            <span className="font-medium text-gray-800">{category.category}:</span>{' '}
                            <span className="text-gray-700">
                              {category.status === 'needs budget' 
                                ? `No budget set. You've spent ${formatCurrency(category.spent)}.` 
                                : `${category.status}`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Budget Suggestions</h3>
                    <p className="mb-4 text-gray-600 text-sm">
                      These suggestions are based on your current spending patterns. Adjust as needed for your financial goals.
                    </p>
                    
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Category
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Current Spending
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Current Budget
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Suggested Budget
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {recommendations.suggestions.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                {item.category}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 text-right">
                                {formatCurrency(item.spent)}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 text-right">
                                {formatCurrency(item.currentBudget)}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-green-600 font-medium text-right">
                                {formatCurrency(item.suggestedBudget)}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-right">
                                <button
                                  onClick={() => {
                                    setBudgets({
                                      ...budgets,
                                      [item.category]: item.suggestedBudget
                                    });
                                  }}
                                  className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 font-medium py-1 px-2 rounded"
                                >
                                  Apply
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">
            No spending data available to generate budget recommendations.
          </p>
        )}
      </div>
    </div>
  );
}