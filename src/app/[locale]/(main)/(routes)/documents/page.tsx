"use client";

import Image from "next/image";
import { useUser } from "@clerk/clerk-react";
import { PlusCircle } from "lucide-react";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";

import { api } from "@/convex/_generated/api";
import { Button } from "@/src/components/ui/button";
import { toast } from "sonner";

export default function DocumentsPage() {
  const { user } = useUser();
  const create = useMutation(api.documents.create);
  const t = useTranslations("Documents");

  const onCreate = () => {
    const promise = create({ title: t("untitled") });

    toast.promise(promise, {
      loading: t("creatingNote"),
      success: t("noteCreated"),
      error: t("failedToCreateNote"),
    });
  };

  return (
    <div className="flex flex-col justify-center items-center h-full space-y-4">
      <Image
        className="dark:hidden"
        src="/empty.png"
        alt="Empty"
        width="300"
        height="300"
      />
      <Image
        className="hidden dark:block"
        src="/empty-dark.png"
        alt="Empty"
        width="300"
        height="300"
      />
      <h2 className="text-lg font-medium">
        {t("welcome", { name: user?.firstName ?? "" })}
      </h2>
      <Button onClick={onCreate}>
        <PlusCircle className="w-4 h-4 mr-2" />
        {t("createNote")}
      </Button>
    </div>
  );
}
