from .base import Base
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from sqlalchemy import Integer, String, DateTime, ForeignKey, Text, JSON


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Rate limiting fields
    last_query_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    
    # Token/Credits system - users get 10 tokens per day
    tokens_remaining: Mapped[int] = mapped_column(Integer, default=10)
    tokens_reset_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )

    # A User can have many Chats.
    # back_populates="user" links back to the user field in the Chat model.
    # cascade="all, delete-orphan" → if a user is deleted, all their chats are deleted too (prevents orphaned chats).
    chats: Mapped[List["Chat"]] = relationship(
        "Chat", back_populates="user", cascade="all, delete-orphan"
    )

    def can_make_query(self) -> bool:
        """Check if user can make a query based on rate limiting and tokens"""
        # Special user gets unlimited access
        if self.email == "grabhaymishra@gmail.com":
            return True

        # Check if we need to reset tokens (24 hours passed)
        if self.tokens_reset_at is None or datetime.now(timezone.utc) >= self.tokens_reset_at:
            # Reset tokens
            self.tokens_remaining = 10
            self.tokens_reset_at = datetime.now(timezone.utc) + timedelta(hours=24)
            return True
        
        return self.tokens_remaining > 0

    def use_token(self) -> bool:
        """Use one token and return True if successful, False if no tokens left"""
        if self.email == "grabhaymishra@gmail.com":
            return True 
        
        if self.tokens_reset_at is None or datetime.now(timezone.utc) >= self.tokens_reset_at:
            self.tokens_remaining = 10
            self.tokens_reset_at = datetime.now(timezone.utc) + timedelta(hours=24)
        
        if self.tokens_remaining > 0:
            self.tokens_remaining -= 1
            self.last_query_at = datetime.now(timezone.utc)
            return True
        return False
    
    def get_time_until_reset(self) -> float:
        """Get hours until token reset"""
        if self.tokens_reset_at is None:
            return 0
        time_diff = self.tokens_reset_at - datetime.now(timezone.utc)
        return max(0, time_diff.total_seconds() / 3600)

    def update_last_query(self):
        """Update the last query timestamp"""
        self.last_query_at = datetime.now(timezone.utc)


class Chat(Base):
    __tablename__ = "chats"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    app_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    
    # Vercel deployment fields
    vercel_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    deployment_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # GitHub export field
    github_repo_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    
    # Build status tracking (for page refresh persistence)
    build_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default=None)  # 'building', 'completed', 'failed', 'cancelled', None
    build_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_build_event: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Last build message for debugging

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship("User", back_populates="chats")
    messages: Mapped[List["Message"]] = relationship(
        "Message", back_populates="chat", cascade="all, delete-orphan", order_by="Message.created_at"
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    chat_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("chats.id", ondelete="CASCADE")
    )
    role: Mapped[str] = mapped_column(String(50))  # 'user' or 'assistant'
    content: Mapped[str] = mapped_column(Text)  # Use Text for unlimited size
    event_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # For system events like 'builder_started'
    tool_calls: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # Store tool calls as JSON: [{name: str, status: 'success'|'error', output: str}]

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    chat: Mapped["Chat"] = relationship("Chat", back_populates="messages")


class Contract(Base):
    """Stores deployed smart contract information from AcademicChain"""
    __tablename__ = "contracts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    chat_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("chats.id", ondelete="CASCADE"), index=True
    )
    
    # Contract identification
    contract_name: Mapped[str] = mapped_column(String(255), nullable=False)
    contract_address: Mapped[str] = mapped_column(String(42), nullable=False, index=True)
    
    # Network information
    network: Mapped[str] = mapped_column(String(50), nullable=False)  # 'sepolia', 'basecamp-testnet', etc.
    chain_id: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Contract data
    abi: Mapped[dict] = mapped_column(JSON, nullable=False)  # Full contract ABI
    source_code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Solidity source
    
    # AcademicChain integration
    job_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)  # AcademicChain job ID
    deploy_tx_hash: Mapped[Optional[str]] = mapped_column(String(66), nullable=True)  # Transaction hash
    
    # Verification status
    verified: Mapped[bool] = mapped_column(Integer, default=False)  # Contract verified on explorer
    explorer_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    
    # Metadata
    deployment_status: Mapped[str] = mapped_column(String(50), default="pending")  # 'pending', 'deployed', 'failed'
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    
    # Relationships
    chat: Mapped["Chat"] = relationship("Chat", backref="contracts")


class ProjectFile(Base):
    """Store all project files for real-time viewing and ZIP download"""
    __tablename__ = "project_files"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("chats.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )
    
    # Relationships
    chat: Mapped["Chat"] = relationship("Chat", backref="files")
