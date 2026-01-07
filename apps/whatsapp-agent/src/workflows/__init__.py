"""
Workflow execution system for ZapComm WhatsApp agent
Enables preset-based conversation flows with conditional branching
"""

from .executor import WorkflowExecutor, WorkflowExecutionResult

__all__ = ['WorkflowExecutor', 'WorkflowExecutionResult']
