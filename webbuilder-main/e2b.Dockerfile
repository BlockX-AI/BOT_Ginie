FROM e2bdev/code-interpreter:latest 

# Set working directory
WORKDIR /home/user

RUN apt-get update && apt-get install -y tree
# Install Vite (React template) and TailwindCSS
RUN npm create vite-react-ai@latest react-app && \
    cd react-app && \
    npm install && \
    npm install ethers@^6.10.0 wagmi@^2.5.7 viem@^2.7.13 @rainbow-me/rainbowkit@^2.0.0 @tanstack/react-query@^5.0.0 web3@^4.5.0

WORKDIR /home/user/react-app
