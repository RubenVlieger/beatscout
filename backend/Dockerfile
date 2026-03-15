FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install UV package manager (faster than pip)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Copy requirements
COPY requirements.txt .

# Install Python dependencies using UV (faster than pip)
RUN uv pip install --no-cache --system -r requirements.txt

# Copy app code
COPY app/ ./app/

# Copy example data for explorer demo
COPY example_data.json ./example_data.json

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
