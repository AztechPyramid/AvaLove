import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type AgentErrorBoundaryProps = {
  children: ReactNode;
  title?: string;
};

type AgentErrorBoundaryState = {
  hasError: boolean;
  errorMessage?: string;
};

export class AgentErrorBoundary extends Component<AgentErrorBoundaryProps, AgentErrorBoundaryState> {
  state: AgentErrorBoundaryState = {
    hasError: false,
    errorMessage: undefined,
  };

  static getDerivedStateFromError(error: unknown): AgentErrorBoundaryState {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { hasError: true, errorMessage: msg };
  }

  componentDidCatch(error: unknown) {
    // Keep noise low; but ensure we have breadcrumbs for debugging.
    console.error("Agent panel crashed:", error);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMessage: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="py-8 text-center text-zinc-400 space-y-3">
          <AlertTriangle className="w-8 h-8 mx-auto opacity-60" />
          <div className="space-y-1">
            <p className="text-sm text-white">
              {this.props.title ? `${this.props.title} sekmesinde hata oluştu` : "Panelde hata oluştu"}
            </p>
            {this.state.errorMessage ? (
              <p className="text-xs text-zinc-500 break-all">{this.state.errorMessage}</p>
            ) : null}
          </div>
          <Button variant="outline" onClick={this.handleRetry} className="border-zinc-700 text-zinc-300">
            <RefreshCw className="w-4 h-4 mr-2" />
            Tekrar dene
          </Button>
        </CardContent>
      </Card>
    );
  }
}
