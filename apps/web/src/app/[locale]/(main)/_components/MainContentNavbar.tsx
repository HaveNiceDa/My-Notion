"use client";

import { useCallback } from "react";
import { MenuIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useNavigation } from "@notion/business/hooks";
import { Navbar } from "./Navbar";

export function MainContentNavbar() {
  const params = useParams();
  const { isCollapsed, setIsCollapsed } = useNavigation();

  const resetWidth = useCallback(() => {
    setIsCollapsed(false);
  }, [setIsCollapsed]);

  return (
    <div className="absolute left-0 right-0 top-0 z-50">
      {!!params.documentId ? (
        <Navbar isCollapsed={isCollapsed} onResetWidth={resetWidth} />
      ) : (
        <nav className="w-full bg-transparent px-3 py-2">
          {isCollapsed && (
            <MenuIcon
              className="h-6 w-6 text-muted-foreground"
              onClick={resetWidth}
              role="button"
            />
          )}
        </nav>
      )}
    </div>
  );
}
