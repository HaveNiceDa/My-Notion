"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/src/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// AI 面板错误边界：捕获子组件渲染错误，防止整个面板白屏
// 用户可点击重试按钮恢复面板，无需刷新页面
class AIChatErrorBoundaryInner extends React.Component<
  ErrorBoundaryProps & { t: (key: string) => string },
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps & { t: (key: string) => string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="h-full flex flex-col items-center justify-center p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">
            {this.props.t("panelError")}
          </p>
          <p className="text-xs text-muted-foreground mb-4 max-w-[240px]">
            {this.props.t("panelErrorDesc")}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleRetry}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {this.props.t("retry")}
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export function AIChatErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  const t = useTranslations("AI");
  return (
    <AIChatErrorBoundaryInner t={t} fallback={fallback}>
      {children}
    </AIChatErrorBoundaryInner>
  );
}
