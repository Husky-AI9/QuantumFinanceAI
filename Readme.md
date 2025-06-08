Financial Sonar API
===================

The Financial Sonar API is a comprehensive financial analysis tool that leverages the power of large language models to provide real-time insights into the stock market. It offers a suite of services, including news summaries, sentiment analysis, risk assessment, in-depth research, and trading strategy generation. The API is built with FastAPI and integrates with Perplexity AI for advanced data analysis and Alpha Vantage for financial data retrieval.

Features
--------

-   **News Summaries**: Get the most significant news for a company from the last 30 days.
-   **Sentiment Analysis**: Identify key sentiment drivers for a given stock.
-   **Risk Assessment**: Uncover the top risk factors for a specific stock.
-   **In-depth Research**: Generate a comprehensive narrative analysis report for a stock.
-   **Trading Strategies**: Develop time-based trading strategies (intraday, weekly, monthly).
-   **Market Dashboard**: View dominant market narratives across various financial sectors.
-   **Ask an Assistant**: Get answers to general finance-related questions.

Project Structure
-----------------
~~~
.
├── frontend/                 # React web application
├── main.py                   # FastAPI application and core logic
├── strategy.py               # Trading strategy generation logic
├── secret.yml                # API key configuration
├── requirements.txt          # Python dependencies
├── start_frontend.cmd        # Script to launch the frontend
└── README.md                 # ReadMe
└── License.txt               # License
~~~

Steps for Judging and Testing
-----------------------------

Check out the project at : https://quantum-finance-ai-deploy.vercel.app

To get the Financial Sonar API up and running locally, follow these steps:

### 1\. Prerequisites

-   Node.js and npm (for the frontend)
-   API keys for Perplexity AI and AlphaAdvantage
    -   Get your Perplexity AI key here https://docs.perplexity.ai/guides/getting-started (or email kurst811@gmail.com for a free api_key for testing)
    -   Get your Alpha Advanrage API Key here: https://www.alphavantage.co/support/#api-key


### 2\. Backend Setup
-   **1. Create a project in HP AI Studio and clone the repository with HP AI Studio**
-   **2. Clone the repsitory into your HP AI Studio project location**
-   **3. Create a workspace using Environment Data Science**
-   **4. Launch your workspace and go into the QuantumFinance folder**
-   **5. Open the secret.yml and configure your Perplexity API key and AlphaAdvantage API key**
-   **6. Run the following commands :**
~~~
pip install -r requirements.txt
python main.py log_mlflow_model
~~~
-   **7. This log your model with mlflow and now you can deploy it using HP AI Studio deployment tab**
-   **8. When deploying with HP AI Studio make sure to select the newly created workspace in "Choose Your Workspace"**

### 3\. Frontend Setup
-   **1. Go into the frontend folder insisde the QuantumFinance folder and open the file called "env.local"**
-   **2. set the port number to the one that is show in the deployment tab in HP AI Finance Studio**
-   **3. Go back into QuantumFinance folder and double click on start_frontend.cmd**
-   **4. The web app should now be on http://localhost:3000**

### 4\. Testing the API

You can test the API in a few ways:

-   **Via the Frontend**: Use the web application to interact with each feature.
-   **Via Swagger UI**: Open URL that show in HP AI Studio Deployment in your browser to send requests directly to the API endpoints. Put the following command in the "Request body" to test each feature:
       
       Momentum Dashboard
       ~~~
        {
            "inputs": {
                "action": [
                "dashboard"
                ]
            },
            "params": {}
        }
       ~~~

       Stock Strategy
       ~~~
        {
            "inputs": {
                "action": [
                "strategy"
                ],
                "company_name": [
                "AAPL"
                ],
                "timeframe": [
                "intraday"
                ]
            
            },
            "params": {}
        }
       ~~~

       Stock Research
       ~~~
        {
            "inputs": {
                "action": [
                "research"
                ],
                "company_name": [
                "AAPL"
                ],
            "lookback": [
                30
                ]
            },
            "params": {}
        }
       ~~~

       News
       ~~~
        {
            "inputs": {
                "action": [
                "news"
                ],
                "company_name": [
                "AAPL"
                ]
            },
            "params": {}
        }
       ~~~

       Risk
       ~~~
        {
            "inputs": {
                "action": [
                "risk"
                ],
                "stock_name": [
                "AAPL"
                ]
            },
            "params": {}
        }
       ~~~

       Risk
       ~~~
        {
            "inputs": {
                "action": [
                "sentiment"
                ],
                "stock_name": [
                "AAPL"
                ]
            },
            "params": {}
        }
       ~~~

       Risk
       ~~~
        {
            "inputs": {
                "action": [
                "assist"
                ],
                "question": [
                ""Short summary of AAPL earning call"
                ]
            },
            "params": {}
        }
       ~~~


    
-   **Command-line Test Script**: The `main.py` script includes a built-in test function. Inside your HP AI Studio jupyter workspace go to QuantumFinance folder and run the following command:
~~~
python main.py test_analyzer
~~~

Models and Methods Explained
----------------------------

This project utilizes external AI models via APIs and is structured into several key Python classes and methods.

### External Models

-   **Perplexity AI (`sonar-pro` & `sonar-deep-research`)**: This is the core AI engine for the application.
    -   `sonar-pro`: A powerful, fast model used for real-time analysis tasks like news summaries, sentiment analysis, risk assessment, and generating trading strategies. It's designed for concise and immediate responses.
    -   `sonar-deep-research`: A more comprehensive model used for the detailed `/research` endpoint. It takes longer to process but provides a more in-depth narrative report.
-   **Alpha Vantage API**: This service is used to fetch raw financial data, including historical stock prices (intraday, daily, and monthly), which is then used as the basis for generating trading strategies.

### Core Methods

#### `FinancialSonarAnalyzer` Class (`main.py`)

This class orchestrates the financial analysis by calling the Perplexity API with carefully crafted prompts for each specific task.

-   **.news(company_name)**: Generates a two-sentence summary of the most significant development for a company in the last 30 days.
-   **.sentiment(stock_name)**: Produces up to three concise sentences that act as sentiment drivers for a given stock.
-   **.risk(stock_name)**: Identifies up to three key risk factors, each presented with a headline and a brief explanation.
-   **.research(stock_name, lookback)**: Creates a detailed, multi-section report on a stock, covering narrative themes, sentiment, discussion prominence, and financial data.
-   **.strategy(ticker, timeframe)**: Initiates the process of generating a trading strategy by calling the `TimeBasedStrategyGenerator`.
-   **.dashboard()**: Generates a JSON object containing the dominant market narratives for a predefined list of financial sectors.
-   **.assist(question)**: Provides answers to general financial questions.

#### `TimeBasedStrategyGenerator` Class (`strategy.py`)

This class is responsible for creating data-driven trading strategies.

-   **._fetch_alpha_vantage_data(ticker, timeframe)**: Fetches historical stock data from Alpha Vantage based on the specified ticker and timeframe (intraday, weekly, or monthly). It cleans and formats the data into a pandas DataFrame.
-   **._call_sonar_api(...)**: Takes the formatted historical data and sends it to the Perplexity Sonar Pro model with a prompt that asks the AI to act as a quantitative strategist. The AI then analyzes the data and proposes entry conditions, exit conditions (for profit and loss), and a rationale for the strategy.
-   **.generate_strategy(ticker, timeframe)**: The main method of the class that orchestrates the process of fetching data and calling the Sonar API to produce the final trading strategy.

