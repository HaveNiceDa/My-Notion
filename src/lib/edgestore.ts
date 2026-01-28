"use client";
import { type EdgeStoreRouter } from "../app/[locale]/[...edgestore]/route";
import { createEdgeStoreProvider } from "@edgestore/react";
const { EdgeStoreProvider, useEdgeStore } =
  createEdgeStoreProvider<EdgeStoreRouter>();
export { EdgeStoreProvider, useEdgeStore };
