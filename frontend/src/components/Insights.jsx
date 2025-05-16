// src/components/Insights.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

export default function Insights({ parsedData }) {
  const [spendingTrends, setSpendingTrends] = useState([]);
  const [categoryTrends, setCategoryTrends] = useState({});
  const [topMerchants, setTopMerchants] = useState([]);
  const [insights, setInsights] = useState([]);
  const [selectedInsightIndex, setSelectedInsightIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!parsedData) {
      // If no data is loaded, redirect to upload page
      navigate('/upload');
      return;
    }

    if (parsedData.transactions) {
      const transactions = parsedData.transactions;
      analyzeTransactions(transactions);
    }
  }, [parsedData, navigate]);

  const analyzeTransactions = (transactions) => {
    // Group transactions by date (month and year)
    const spendingByDate = {};
    
    // Group transactions by merchant
    const merchantSpending = {};
    
    // Group transactions by category and date
    const categoryByDate = {};
    
    transactions.forEach(transaction => {
      const date = new Date(transaction.date);
      const monthYear = `${date.getFullYear()}-${date.getMonth() + 1}`;
      const amount = parseFloat(transaction.amount);
      const category = transaction.category || 'Uncategorized';
      const merchant = transaction.description;
      
      // Calculate spending by date
      if (!spendingByDate[monthYear]) {
        spendingByDate[monthYear] = {
          date: monthYear,
          income: 0,
          expense: 0,
          net: 0
        };
      }
      
      if (amount > 0) {
        spendingByDate[monthYear].income += amount;
      } else {
        spendingByDate[monthYear].expense += Math.abs(amount);
      }
      
      spendingByDate[monthYear].net += amount;
      
      // Calculate merchant spending (only for expenses)
      if (amount < 0) {
        if (!merchantSpending[merchant]) {
          merchantSpending[merchant] = 0;
        }
        merchantSpending[merchant] += Math.abs(amount);
      }
      
      // Calculate category spending by date
      if (amount < 0) { // Only track expenses by category
        if (!categoryByDate[category]) {
          categoryByDate[category] = {};
        }
        
        if (!categoryByDate[category][monthYear]) {
          categoryByDate[category][monthYear] = 0;
        }
        
        categoryByDate[category][monthYear] += Math.abs(amount);
      }
    });
    
    // Convert spending by date to array and sort by date
    const spendingTrendsArray = Object.values(spendingByDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(data => ({
        ...data,
        month: formatMonthYear(data.date)
      }));
    
    setSpendingTrends(spendingTrendsArray);
    
    // Convert category by date to a format suitable for charts
    const categoryTrendsData = {};
    
    Object.keys(categoryByDate).forEach(category => {
      const data = spendingTrendsArray.map(trend => {
        return {
          month: trend.month,
          spending: categoryByDate[category][trend.date] || 0
        };
      });
      
      categoryTrendsData[category] = data;
    });
    
    setCategoryTrends(categoryTrendsData);
    
    // Get top 5 merchants by spending
    const topMerchantsArray = Object.entries(merchantSpending)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amount]) => ({ name, amount }));
    
    setTopMerchants(topMerchantsArray);
    
    // Generate AI insights
    generateInsights(transactions, spendingTrendsArray, categoryByDate, topMerchantsArray);
  };

  const generateInsights = (transactions, spendingTrends, categoryByDate, topMerchants) => {
    const insights = [];
    
    // Insight 1: Overall spending trend
    if (spendingTrends.length > 1) {
      const lastMonthIndex = spendingTrends.length - 1;
      const lastMonth = spendingTrends[lastMonthIndex];
      const previousMonth = spendingTrends[lastMonthIndex - 1];
      
      if (lastMonth && previousMonth) {
        const expenseChange = lastMonth.expense - previousMonth.expense;
        const expenseChangePercent = (expenseChange / previousMonth.expense) * 100;
        
        insights.push({
          title: 'Monthly Spending Trend',
          description: `Your spending ${expenseChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(expenseChangePercent).toFixed(1)}% from last month.`,
          type: expenseChange > 0 ? 'warning' : 'success',
          actionable: expenseChange > 0 
            ? 'Review your recent expenses to identify areas where you can cut back.' 
            : 'Great job managing your spending! Keep up the good work.',
          chart: 'spendingTrend'
        });
      }
    }
    
    // Insight 2: Category with biggest change
    const categoryChanges = [];
    
    Object.keys(categoryByDate).forEach(category => {
      const months = Object.keys(categoryByDate[category]).sort();
      
      if (months.length >= 2) {
        const lastMonth = months[months.length - 1];
        const previousMonth = months[months.length - 2];
        
        if (categoryByDate[category][lastMonth] && categoryByDate[category][previousMonth]) {
          const change = categoryByDate[category][lastMonth] - categoryByDate[category][previousMonth];
          const changePercent = (change / categoryByDate[category][previousMonth]) * 100;
          
          if (!isNaN(changePercent) && isFinite(changePercent)) {
            categoryChanges.push({
              category,
              change,
              changePercent,
              lastMonthSpending: categoryByDate[category][lastMonth]
            });
          }
        }
      }
    });
    
    if (categoryChanges.length > 0) {
      // Find category with biggest increase
      const biggestIncrease = categoryChanges
        .filter(c => c.change > 0)
        .sort((a, b) => b.changePercent - a.changePercent)[0];
      
      // Find category with biggest decrease
      const biggestDecrease = categoryChanges
        .filter(c => c.change < 0)
        .sort((a, b) => a.changePercent - b.changePercent)[0];
      
      if (biggestIncrease) {
        insights.push({
          title: 'Biggest Spending Increase',
          description: `Your spending on ${biggestIncrease.category} increased by ${biggestIncrease.changePercent.toFixed(1)}% from last month.`,
          type: 'warning',
          actionable: `Consider setting a budget for ${biggestIncrease.category} to keep your spending in check.`,
          chart: 'categoryTrend',
          chartData: biggestIncrease.category
        });
      }
      
      if (biggestDecrease) {
        insights.push({
          title: 'Biggest Spending Decrease',
          description: `Your spending on ${biggestDecrease.category} decreased by ${Math.abs(biggestDecrease.changePercent).toFixed(1)}% from last month.`,
          type: 'success',
          actionable: 'Great job reducing your spending in this category!',
          chart: 'categoryTrend',
          chartData: biggestDecrease.category
        });
      }
    }
    
    // Insight 3: Top merchant spending
    if (topMerchants.length > 0) {
      const topMerchant = topMerchants[0];
      
      insights.push({
        title: 'Top Merchant Spending',
        description: `Your top merchant is ${topMerchant.name}, where you've spent ${formatCurrency(topMerchant.amount)}.`,
        type: 'info',
        actionable: 'Consider if your spending at this merchant aligns with your financial goals.',
        chart: 'topMerchants'
      });
    }
    
    // Insight 4: Income vs Expense
    if (spendingTrends.length > 0) {
      const lastMonth = spendingTrends[spendingTrends.length - 1];
      const netIncome = lastMonth.income - lastMonth.expense;
      const savingsRate = (netIncome / lastMonth.income) * 100;
      
      if (!isNaN(savingsRate) && isFinite(savingsRate)) {
        insights.push({
          title: 'Savings Rate',
          description: `Your savings rate for ${lastMonth.month} was ${savingsRate.toFixed(1)}% of your income.`,
          type: savingsRate >= 20 ? 'success' : savingsRate >= 10 ? 'info' : 'warning',
          actionable: savingsRate >= 20 
            ? 'Excellent savings rate! Consider investing your savings for long-term growth.' 
            : savingsRate >= 10 
              ? 'Good start! Try to increase your savings rate to 20% for better financial security.' 
              : 'Try to increase your savings rate by reducing expenses or increasing income.',
          chart: 'savingsRate'
        });
      }
    }
    
    // Insight 5: Recurring expenses
    const recurringMerchants = findRecurringExpenses(transactions);
    
    if (recurringMerchants.length > 0) {
      const totalRecurring = recurringMerchants.reduce((sum, merchant) => sum + merchant.averageAmount, 0);
      
      insights.push({
        title: 'Recurring Expenses',
        description: `You have approximately ${formatCurrency(totalRecurring)} in recurring monthly expenses.`,
        type: 'info',
        actionable: 'Review your subscriptions and recurring expenses to see if there are any you can eliminate.',
        chart: 'recurringExpenses',
        chartData: recurringMerchants
      });
    }
    
    setInsights(insights);
  };

  const findRecurringExpenses = (transactions) => {
    // Map merchants to their transaction dates
    const merchantDates = {};
    const merchantAmounts = {};
    
    transactions
      .filter(t => parseFloat(t.amount) < 0) // Only expenses
      .forEach(transaction => {
        const merchant = transaction.description;
        const date = new Date(transaction.date);
        const amount = Math.abs(parseFloat(transaction.amount));
        
        if (!merchantDates[merchant]) {
          merchantDates[merchant] = [];
          merchantAmounts[merchant] = [];
        }
        
        merchantDates[merchant].push(date);
        merchantAmounts[merchant].push(amount);
      });
    
    // Find merchants with regular interval between transactions
    const recurringMerchants = [];
    
    Object.keys(merchantDates).forEach(merchant => {
      const dates = merchantDates[merchant].sort((a, b) => a - b);
      
      if (dates.length >= 2) {
        // Calculate average interval in days
        let totalDays = 0;
        for (let i = 1; i < dates.length; i++) {
          totalDays += (dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24);
        }
        
        const avgInterval = totalDays / (dates.length - 1);
        const stdDeviation = calculateStdDeviation(dates);
        
        // Calculate average amount
        const amounts = merchantAmounts[merchant];
        const avgAmount = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
        
        // If interval is regular (low std deviation) and close to monthly (25-35 days)
        // or biweekly (12-16 days)
        if (stdDeviation < 5 && 
            ((avgInterval >= 25 && avgInterval <= 35) || 
             (avgInterval >= 12 && avgInterval <= 16))) {
          recurringMerchants.push({
            name: merchant,
            interval: avgInterval,
            frequency: avgInterval >= 25 ? 'Monthly' : 'Biweekly',
            averageAmount: avgAmount
          });
        }
      }
    });
    
    return recurringMerchants
      .sort((a, b) => b.averageAmount - a.averageAmount)
      .slice(0, 5);
  };

  const calculateStdDeviation = (dates) => {
    if (dates.length < 2) return 0;
    
    // Calculate intervals
    const intervals = [];
    for (let i = 1; i < dates.length; i++) {
      intervals.push((dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24));
    }
    
    // Calculate mean
    const mean = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    // Calculate sum of squared differences
    const squaredDiffs = intervals.map(interval => Math.pow(interval - mean, 2));
    const variance = squaredDiffs.reduce((sum, sqDiff) => sum + sqDiff, 0) / intervals.length;
    
    return Math.sqrt(variance);
  };

  const formatMonthYear = (dateStr) => {
    const [year, month] = dateStr.split('-');
    return `${getMonthName(parseInt(month))} ${year}`;
  };

  const getMonthName = (monthNum) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthNum - 1];
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getChartForInsight = (insight) => {
    switch (insight.chart) {
      case 'spendingTrend':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={spendingTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis 
                tickFormatter={(tick) => tick === 0 ? '$0' : `$${tick.toLocaleString()}`} 
              />
              <Tooltip 
                formatter={(value) => formatCurrency(value)}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="income" 
                stroke="#00C49F" 
                name="Income" 
                activeDot={{ r: 8 }} 
              />
              <Line 
                type="monotone" 
                dataKey="expense" 
                stroke="#FF8042" 
                name="Expenses" 
                activeDot={{ r: 8 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        );
      
      case 'categoryTrend':
        if (!insight.chartData || !categoryTrends[insight.chartData]) return null;
        
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={categoryTrends[insight.chartData]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis 
                tickFormatter={(tick) => tick === 0 ? '$0' : `$${tick.toLocaleString()}`} 
              />
              <Tooltip 
                formatter={(value) => formatCurrency(value)}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="spending" 
                stroke="#8884d8" 
                name={`${insight.chartData} Spending`} 
                activeDot={{ r: 8 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        );
      
      case 'topMerchants':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topMerchants}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis 
                tickFormatter={(tick) => tick === 0 ? '$0' : `$${tick.toLocaleString()}`} 
              />
              <Tooltip 
                formatter={(value) => formatCurrency(value)}
                labelFormatter={(label) => `Merchant: ${label}`}
              />
              <Legend />
              <Bar dataKey="amount" fill="#8884d8" name="Amount Spent" />
            </BarChart>
          </ResponsiveContainer>
        );
      
      case 'savingsRate':
        const savingsData = spendingTrends.map(month => ({
          month: month.month,
          rate: month.income > 0 ? ((month.income - month.expense) / month.income) * 100 : 0
        }));
        
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={savingsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis 
                tickFormatter={(tick) => `${tick.toFixed(0)}%`} 
              />
              <Tooltip 
                formatter={(value) => `${value.toFixed(1)}%`}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="rate" 
                stroke="#82ca9d" 
                name="Savings Rate" 
                activeDot={{ r: 8 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        );
      
      case 'recurringExpenses':
        if (!insight.chartData) return null;
        
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={insight.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis 
                tickFormatter={(tick) => tick === 0 ? '$0' : `$${tick.toLocaleString()}`} 
              />
              <Tooltip 
                formatter={(value) => formatCurrency(value)}
                labelFormatter={(label) => `Merchant: ${label}`}
              />
              <Legend />
              <Bar dataKey="averageAmount" fill="#8884d8" name="Monthly Amount" />
            </BarChart>
          </ResponsiveContainer>
        );
      
      default:
        return null;
    }
  };

  // Get background color for card based on insight type
  const getCardBgColor = (type) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  // Get text color for card based on insight type
  const getCardTextColor = (type) => {
    switch (type) {
      case 'success':
        return 'text-green-800';
      case 'warning':
        return 'text-yellow-800';
      case 'info':
        return 'text-blue-800';
      default:
        return 'text-gray-800';
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Financial Insights</h1>
      
      {insights.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Insights List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-4">
              <h2 className="text-lg font-medium mb-4 text-gray-700">Key Insights</h2>
              <ul className="space-y-2">
                {insights.map((insight, index) => (
                  <li key={index}>
                    <button
                      onClick={() => setSelectedInsightIndex(index)}
                      className={`w-full text-left p-3 rounded-md border transition-colors ${
                        selectedInsightIndex === index
                          ? `${getCardBgColor(insight.type)} ${getCardTextColor(insight.type)}`
                          : 'border-transparent hover:bg-gray-50'
                      }`}
                    >
                      <h3 className="font-medium">
                        {insight.title}
                      </h3>
                      <p className="text-sm mt-1 text-gray-600">
                        {insight.description}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          {/* Selected Insight Details */}
          <div className="lg:col-span-2">
            {insights[selectedInsightIndex] && (
              <div className={`rounded-lg shadow-md p-6 border ${
                getCardBgColor(insights[selectedInsightIndex].type)
              }`}>
                <h2 className={`text-xl font-bold mb-2 ${
                  getCardTextColor(insights[selectedInsightIndex].type)
                }`}>
                  {insights[selectedInsightIndex].title}
                </h2>
                
                <p className="text-gray-700 mb-4">
                  {insights[selectedInsightIndex].description}
                </p>
                
                <div className="bg-white rounded-lg p-4 mb-4">
                  {getChartForInsight(insights[selectedInsightIndex])}
                </div>
                
                <div className="bg-white rounded-lg p-4 border-l-4 border-blue-500">
                  <h3 className="font-medium text-gray-800 mb-1">
                    Actionable Advice
                  </h3>
                  <p className="text-gray-700">
                    {insights[selectedInsightIndex].actionable}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <svg 
            className="mx-auto h-12 w-12 text-gray-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" 
            />
          </svg>
          <h2 className="mt-2 text-lg font-medium text-gray-900">No insights available</h2>
          <p className="mt-1 text-sm text-gray-500">
            Upload more statements to generate financial insights.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => navigate('/upload')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Upload Statements
            </button>
          </div>
        </div>
      )}
    </div>
  );
}