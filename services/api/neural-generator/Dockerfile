FROM alpine:latest

RUN apk add --no-cache g++ make cmake git curl python3 py3-pip

WORKDIR /app

# Build llama.cpp
RUN git clone https://github.com/ggerganov/llama.cpp
RUN cd llama.cpp && make

# Copy model (download separately, see instructions)
COPY models/qwen3-codersmall-0.8b-q4_k_m.gguf /app/models/model.gguf
COPY src/ /app/src/

RUN pip install fastapi uvicorn

EXPOSE 8002

# Limit memory usage and threads
CMD ["uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "8002"]