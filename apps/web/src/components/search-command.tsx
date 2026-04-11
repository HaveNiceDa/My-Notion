"use client";

import { File } from "lucide-react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/clerk-react";
import { useTranslations } from "next-intl";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/src/components/ui/command";
import { useSearch } from "@/src/hooks/use-search";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";

export function SearchCommand() {
  const { user } = useUser();
  const router = useRouter();
  const documents = useQuery(api.documents.getSearch);
  const [isMounted, setIsMounted] = useState(false);
  const t = useTranslations('SearchCommand');

  const toggle = useSearch((store) => store.toggle);
  const isOpen = useSearch((store) => store.isOpen);
  const onClose = useSearch((store) => store.onClose);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [toggle]);

  if (!isMounted) {
    return null;
  }

  return (
    <CommandDialog open={isOpen} onOpenChange={onClose}>
      <CommandInput placeholder={t('placeholder', { name: user?.fullName || 'your' })} />
      <CommandList>
        <CommandEmpty>{t('empty')}</CommandEmpty>
        <CommandGroup heading={t('documents')}>
          {documents?.map((document) => (
            <CommandItem
              key={document._id}
              value={document.title}
              title={document.title}
              onSelect={() => {
                router.push(`/documents/${document._id}`);
                onClose();
              }}
            >
              {document.icon ? (
                <p className="mr-2 text-[18px]">{document.icon}</p>
              ) : (
                <File className="w-4 h-4 mr-2" />
              )}
              <span>{document.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
