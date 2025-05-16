import os
import json
import re
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import PyPDF2

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload size

# Allowed file extensions
ALLOWED_EXTENSIONS = {'pdf'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Dictionary of known bank/card statement formats
BANK_FORMATS = {
    'discover': {
        'header_patterns': [r'DISCOVER IT', r'CARDMEMBER SINCE'],
        'transaction_patterns': [
            r'(\d{2}/\d{2}/\d{2})\s+(\d{2}/\d{2}/\d{2})\s+([-]?\$?\d+\.\d{2})\s+(.*?)\s+(\w+)$',
            r'(\d{2}/\d{2})\s+(.*?)\s+(\w+)\s+([-]?\$\d+\.\d{2})$',
            r'(\d{2}/\d{2}/\d{2})\s+(.*?)\s+(\w+)\s+([-]?\$\d+\.\d{2})$'
        ],
        'transaction_section_markers': ['TRANS.', 'DATE', 'PURCHASES', 'MERCHANT', 'CATEGORY', 'AMOUNT'],
        'balance_pattern': r'New Balance[:\s]+\$([\d,]+\.\d{2})',
        'credit_limit_pattern': r'Credit Line[:\s]+\$([\d,]+)',
        'payment_due_pattern': r'Payment Due Date[:\s]+([\d/]+)',
        'minimum_payment_pattern': r'Minimum Payment Due[:\s]+\$([\d,]+\.\d{2})'
    },
    'orange_county_credit_union': {
        'header_patterns': [r'ORANGE COUNTY\'S CREDIT UNION', r'ACCOUNT STATEMENT'],
        'transaction_patterns': [
            r'(\d{2}/\d{2}/\d{2})\s+(\d{2}/\d{2}/\d{2})\s+([-]?\d+\.\d{2})\s+([-]?\d+\.\d{2})\s+([\d\.]+)\s+(.*?)$',
            r'(\d{2}/\d{2}/\d{2})\s+(\d{2}/\d{2}/\d{2})\s+([-]?\d+\.\d{2})\s+(.*?)\s+([-]?\d+\.\d{2})$'
        ],
        'transaction_section_markers': ['Transaction', 'Date', 'Posting', 'Date', 'Withdrawal', 'Deposit', 'Balance'],
        'balance_pattern': r'Ending Balance[:\s]+\$([\d,]+\.\d{2})',
        'beginning_balance_pattern': r'Beginning Balance[:\s]+\$([\d,]+\.\d{2})',
    }
}

# Categories for transactions based on keywords
CATEGORY_KEYWORDS = {
    'Restaurants': ['restaurant', 'cafe', 'coffee', 'food', 'dining', 'dine', 'eat', 'tst*', 'burger', 'pizza', 
                   'breakfast', 'lunch', 'dinner', 'bar', 'grill', 'kitchen', 'bakery', 'donut', 'wing', 'jollibee',
                   'wingstop', 'elpolloloco', 'matcha', 'boba', 'tea studio', 'marugame', 'carls jr'],
    'Groceries': ['grocery', 'supermarket', 'market', 'food', 'sprouts', 'target', 'walmart', 'costco', 'trader', 
                 'whole foods', 'farmers market', 'mitsuwa', 'lazy acres'],
    'Transportation': ['gas', 'fuel', 'chevron', 'shell', 'uber', 'lyft', 'taxi', 'car', 'auto', 'parking', 'toll'],
    'Entertainment': ['movie', 'cinema', 'theater', 'concert', 'event', 'ticket', 'netflix', 'spotify', 'hulu', 
                     'disney', 'amazon prime', 'game', 'steam', 'playstation', 'xbox', 'amusement', 'bowlero', 'round1'],
    'Shopping': ['amazon', 'target', 'walmart', 'ebay', 'etsy', 'clothing', 'shoe', 'apparel', 'store', 'mall', 
                'shop', 'retail', 'uniqlo', 'merchandise', 'top canvas', 'pop mart'],
    'Utilities': ['electric', 'water', 'gas', 'utility', 'internet', 'phone', 'cable', 'att', 'verizon', 'spectrum', 
                 'comcast', 'bill'],
    'Health': ['doctor', 'hospital', 'clinic', 'medical', 'dental', 'pharmacy', 'prescription', 'cvs', 'walgreens', 
              'health', 'fitness', 'gym'],
    'Travel': ['hotel', 'flight', 'airline', 'airbnb', 'vacation', 'trip', 'travel', 'booking'],
    'Education': ['school', 'college', 'university', 'tuition', 'book', 'course', 'class', 'education', 'student'],
    'Subscription': ['subscription', 'membership', 'recurring'],
    'Financial': ['payment', 'transfer', 'deposit', 'withdraw', 'fee', 'interest', 'loan', 'mortgage', 'rent'],
    'Insurance': ['insurance', 'premium', 'coverage', 'policy'],
    'Gifts & Donations': ['gift', 'donation', 'charity', 'contribute'],
    'Services': ['service', 'repair', 'maintenance', 'clean', 'salon', 'barber', 'haircut', 'spa', 'laundry', 
                'college liquidation', 'parking']
}

def categorize_transaction(description):
    """
    Simple rule-based categorization
    """
    # Convert description to lowercase for better matching
    description_lower = description.lower()
    
    # First, check direct matches with keywords
    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword.lower() in description_lower:
                return category
    
    # If no direct match is found, return 'Uncategorized'
    return 'Uncategorized'

def parse_pdf(file_path):
    """
    Parse a PDF file to extract bank statement information
    """
    logger.debug(f"Parsing PDF file: {file_path}")
    try:
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            
            # Extract text from all pages
            full_text = ""
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                full_text += page.extract_text() + "\n"
            
            # Identify the bank type based on patterns
            bank_type = identify_bank_type(full_text)
            
            if bank_type:
                logger.info(f"Identified bank type: {bank_type}")
                # Extract statement information based on bank type
                return extract_statement_info(full_text, bank_type)
            else:
                logger.error("Unsupported bank statement format")
                return {
                    "error": "Unsupported bank statement format. Currently supporting Discover and Orange County Credit Union statements."
                }
    except Exception as e:
        logger.error(f"Error parsing PDF: {str(e)}")
        raise Exception(f"Error parsing PDF: {str(e)}")

def identify_bank_type(text):
    """
    Identify the bank type based on header patterns
    """
    for bank, patterns in BANK_FORMATS.items():
        header_matches = 0
        for pattern in patterns['header_patterns']:
            if re.search(pattern, text, re.IGNORECASE):
                header_matches += 1
        
        # If all header patterns match, return the bank type
        if header_matches == len(patterns['header_patterns']):
            return bank
    
    return None

def extract_statement_info(text, bank_type):
    """
    Extract statement information based on the bank type
    """
    logger.debug(f"Extracting statement info for bank type: {bank_type}")
    bank_format = BANK_FORMATS[bank_type]
    
    # Extract basic information
    statement_info = {
        "bank_type": bank_type,
        "transactions": []
    }
    
    # Try to extract balance
    balance_match = re.search(bank_format.get('balance_pattern', ''), text)
    if balance_match:
        statement_info["balance"] = float(balance_match.group(1).replace(',', ''))
    
    # Extract additional information based on bank type
    if bank_type == 'discover':
        # Extract credit limit
        credit_limit_match = re.search(bank_format['credit_limit_pattern'], text)
        if credit_limit_match:
            statement_info["credit_limit"] = float(credit_limit_match.group(1).replace(',', ''))
        
        # Extract payment due date
        payment_due_match = re.search(bank_format['payment_due_pattern'], text)
        if payment_due_match:
            statement_info["payment_due_date"] = payment_due_match.group(1)
        
        # Extract minimum payment
        min_payment_match = re.search(bank_format['minimum_payment_pattern'], text)
        if min_payment_match:
            statement_info["minimum_payment"] = float(min_payment_match.group(1).replace(',', ''))
    
    elif bank_type == 'orange_county_credit_union':
        # Extract beginning balance
        beginning_balance_match = re.search(bank_format['beginning_balance_pattern'], text)
        if beginning_balance_match:
            statement_info["beginning_balance"] = float(beginning_balance_match.group(1).replace(',', ''))
    
    # Extract transactions
    statement_info["transactions"] = extract_transactions(text, bank_type)
    
    if not statement_info["transactions"]:
        logger.warning(f"No transactions found for {bank_type} statement")
    else:
        logger.info(f"Found {len(statement_info['transactions'])} transactions for {bank_type} statement")
    
    return statement_info

def extract_transactions(text, bank_type):
    """
    Extract transactions from statement text based on bank type
    """
    logger.debug(f"Extracting transactions for bank type: {bank_type}")
    bank_format = BANK_FORMATS[bank_type]
    transactions = []
    
    if bank_type == 'discover':
        # Find the "Transactions" section
        transaction_sections = re.findall(r'TRANS\.\s+DATE\s+PURCHASES.*?(?=\n\s*TOTAL FEES|$)', text, re.DOTALL)
        
        if transaction_sections:
            transaction_section = transaction_sections[0]
            logger.debug("Found transaction section for Discover statement")
            
            # Use different transaction patterns based on format
            for line in transaction_section.split('\n'):
                # Skip empty lines or header lines
                if not line.strip() or any(marker in line for marker in bank_format['transaction_section_markers']):
                    continue
                
                # Try different transaction patterns
                for pattern in bank_format['transaction_patterns']:
                    match = re.search(pattern, line)
                    if match:
                        # Extract transaction details based on the pattern
                        if len(match.groups()) == 4:  # Pattern with 4 groups
                            date, description, category, amount_str = match.groups()
                            # Convert date to yyyy-mm-dd format
                            date_obj = datetime.strptime(date, '%m/%d')
                            # Assume current year, can be adjusted
                            current_year = datetime.now().year
                            date_formatted = f"{current_year}-{date_obj.month:02d}-{date_obj.day:02d}"
                            
                            # Format amount (remove $ and handle negatives)
                            amount = float(amount_str.replace('$', '').replace(',', ''))
                            
                            # For Discover, expenses are already negative
                            
                            transactions.append({
                                "date": date_formatted,
                                "description": description.strip(),
                                "category": category,
                                "amount": amount,
                                "account": "Discover Credit Card"
                            })
                            break
        else:
            logger.warning("No transaction section found in Discover statement")
        
        # Also look for payments and credits
        payment_sections = re.findall(r'TRANS\.\s+DATE\s+PAYMENTS AND CREDITS.*?(?=\n\s*TRANS|$)', text, re.DOTALL)
        
        if payment_sections:
            payment_section = payment_sections[0]
            logger.debug("Found payments and credits section for Discover statement")
            
            for line in payment_section.split('\n'):
                # Skip empty lines or header lines
                if not line.strip() or any(marker in line for marker in bank_format['transaction_section_markers']):
                    continue
                
                # Look for payment patterns
                payment_match = re.search(r'(\d{2}/\d{2})\s+(.*?)\s+([-]?\$?\d+\.\d{2})', line)
                if payment_match:
                    date, description, amount_str = payment_match.groups()
                    
                    # Convert date to yyyy-mm-dd format
                    date_obj = datetime.strptime(date, '%m/%d')
                    current_year = datetime.now().year
                    date_formatted = f"{current_year}-{date_obj.month:02d}-{date_obj.day:02d}"
                    
                    # Format amount
                    amount = float(amount_str.replace('$', '').replace(',', ''))
                    
                    transactions.append({
                        "date": date_formatted,
                        "description": description.strip(),
                        "category": "Payment",
                        "amount": amount,
                        "account": "Discover Credit Card"
                    })
    
    elif bank_type == 'orange_county_credit_union':
        # Find transaction sections - PACIFIC CHECKING and PACIFIC SAVINGS
        checking_sections = re.findall(r'PACIFIC CHECKING.*?(?=PACIFIC SAVINGS|\Z)', text, re.DOTALL)
        savings_sections = re.findall(r'PACIFIC SAVINGS.*?(?=PACIFIC CHECKING|\Z)', text, re.DOTALL)
        
        # Process checking account transactions
        if checking_sections:
            logger.debug("Found checking account section for OCCU statement")
            for line in checking_sections[0].split('\n'):
                # Skip empty lines or header lines
                if not line.strip() or any(marker in line for marker in bank_format['transaction_section_markers']):
                    continue
                
                # Match transaction pattern for withdraw/deposit format
                trans_match = re.search(r'(\d{2}/\d{2}/\d{2})\s+(\d{2}/\d{2}/\d{2})\s+(-?\d+\.\d{2})?\s+(\d+\.\d{2})?\s+(\d+\.\d{2})\s+(.*?)$', line)
                if trans_match:
                    trans_date, post_date, withdrawal, deposit, balance, description = trans_match.groups()
                    
                    # Convert date to yyyy-mm-dd format
                    date_obj = datetime.strptime(trans_date, '%m/%d/%y')
                    date_formatted = date_obj.strftime('%Y-%m-%d')
                    
                    # Determine amount (negative for withdrawals, positive for deposits)
                    amount = 0
                    if withdrawal:
                        amount = -float(withdrawal)
                    elif deposit:
                        amount = float(deposit)
                    
                    # Categorize transaction
                    category = categorize_transaction(description)
                    
                    transactions.append({
                        "date": date_formatted,
                        "description": description.strip(),
                        "category": category,
                        "amount": amount,
                        "account": "Pacific Checking"
                    })
        else:
            logger.warning("No checking account section found in OCCU statement")
        
        # Process savings account transactions
        if savings_sections:
            logger.debug("Found savings account section for OCCU statement")
            for line in savings_sections[0].split('\n'):
                # Skip empty lines or header lines
                if not line.strip() or any(marker in line for marker in bank_format['transaction_section_markers']):
                    continue
                
                # Match transaction pattern for withdraw/deposit format
                trans_match = re.search(r'(\d{2}/\d{2}/\d{2})\s+(\d{2}/\d{2}/\d{2})\s+(-?\d+\.\d{2})?\s+(\d+\.\d{2})?\s+(\d+\.\d{2})\s+(.*?)$', line)
                if trans_match:
                    trans_date, post_date, withdrawal, deposit, balance, description = trans_match.groups()
                    
                    # Convert date to yyyy-mm-dd format
                    date_obj = datetime.strptime(trans_date, '%m/%d/%y')
                    date_formatted = date_obj.strftime('%Y-%m-%d')
                    
                    # Determine amount (negative for withdrawals, positive for deposits)
                    amount = 0
                    if withdrawal:
                        amount = -float(withdrawal)
                    elif deposit:
                        amount = float(deposit)
                    
                    # Categorize transaction
                    category = categorize_transaction(description)
                    
                    transactions.append({
                        "date": date_formatted,
                        "description": description.strip(),
                        "category": category,
                        "amount": amount,
                        "account": "Pacific Savings"
                    })
        else:
            logger.warning("No savings account section found in OCCU statement")
    
    # Categorize transactions that don't have a category yet
    for transaction in transactions:
        if 'category' not in transaction or not transaction['category'] or transaction['category'] == 'Uncategorized':
            transaction['category'] = categorize_transaction(transaction['description'])
    
    return transactions

@app.route('/api/parse-statements', methods=['POST'])
def parse_statements():
    """
    API endpoint to parse uploaded bank statements
    """
    logger.info("Received request to parse statements")
    
    # Check if files are present in the request
    if 'files' not in request.files:
        logger.error("No files provided in the request")
        return jsonify({"error": "No files provided in the request"}), 400
    
    files = request.files.getlist('files')
    logger.debug(f"Received {len(files)} files")
    
    # Check if the file list is empty
    if not files or files[0].filename == '':
        logger.error("No files selected for upload")
        return jsonify({"error": "No files selected for upload"}), 400
    
    all_transactions = []
    statement_info = {}
    
    for file in files:
        logger.debug(f"Processing file: {file.filename}")
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            
            try:
                # Save the file
                file.save(file_path)
                logger.debug(f"File saved to: {file_path}")
                
                try:
                    # Parse the PDF file
                    statement_data = parse_pdf(file_path)
                    
                    if "error" in statement_data:
                        logger.error(f"Error in statement data: {statement_data['error']}")
                        return jsonify(statement_data), 400
                    
                    # Add transactions to the combined list
                    all_transactions.extend(statement_data["transactions"])
                    
                    # Update statement_info with non-transaction data
                    for key, value in statement_data.items():
                        if key != "transactions":
                            if key not in statement_info:
                                statement_info[key] = {}
                            statement_info[key][filename] = value
                    
                    # Clean up uploaded file
                    os.remove(file_path)
                    logger.debug(f"File removed after processing: {file_path}")
                    
                except Exception as e:
                    # Clean up on error
                    if os.path.exists(file_path):
                        os.remove(file_path)
                    logger.error(f"Error parsing file: {str(e)}")
                    return jsonify({"error": f"Error parsing file: {str(e)}"}), 500
            except Exception as e:
                logger.error(f"Error saving file: {str(e)}")
                return jsonify({"error": f"Error saving file: {str(e)}"}), 500
        else:
            logger.error(f"Invalid file format for {file.filename}. Only PDF files are allowed.")
            return jsonify({"error": f"Invalid file format for {file.filename}. Only PDF files are allowed."}), 400
    
    # Check if any transactions were found
    if not all_transactions:
        logger.error("No transaction data found in the provided files")
        return jsonify({"error": "No transaction data found in the provided files"}), 400
    
    # Sort all transactions by date
    all_transactions.sort(key=lambda x: x["date"], reverse=True)
    
    # Return combined data
    logger.info(f"Returning {len(all_transactions)} transactions")
    return jsonify({
        "transactions": all_transactions,
        "statement_info": statement_info
    })

@app.route('/api/categorize', methods=['POST'])
def categorize_transactions():
    """
    API endpoint to categorize transactions
    """
    logger.info("Received request to categorize transactions")
    if not request.json or 'transactions' not in request.json:
        logger.error("No transactions provided in the request")
        return jsonify({"error": "No transactions provided in the request"}), 400
    
    transactions = request.json['transactions']
    logger.debug(f"Categorizing {len(transactions)} transactions")
    
    for transaction in transactions:
        transaction['category'] = categorize_transaction(transaction['description'])
    
    return jsonify({"transactions": transactions})

@app.route('/api/categories', methods=['GET'])
def get_categories():
    """
    API endpoint to get available categories
    """
    logger.info("Received request to get categories")
    return jsonify({"categories": list(CATEGORY_KEYWORDS.keys())})

@app.route('/api/test', methods=['GET'])
def test_api():
    """
    API endpoint to test if the server is running
    """
    return jsonify({"status": "API is running"})

if __name__ == '__main__':
    app.run(debug=True)