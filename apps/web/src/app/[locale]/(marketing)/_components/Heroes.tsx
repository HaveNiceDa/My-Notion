import Image from "next/image";

export function Heroes () {
return (
    <div className="flex flex-col justify-center items-center max-w-5xl">
      <div className="flex items-center">
        <div className="relative w-[300px] h-[300px] sm:w-[350px] sm:h-[350px] md:h-[400px] md:w-[400px]">
          <Image className="object-contain dark:hidden" src='/documents.png' alt="Documents" fill sizes="(max-width: 768px) 300px, (max-width: 1024px) 350px, 400px" loading="eager" />
          <Image className="object-contain hidden dark:block" src='/documents-dark.png' alt="Documents" fill sizes="(max-width: 768px) 300px, (max-width: 1024px) 350px, 400px" loading="eager" />
        </div>
        <div className="relative w-[400px] h-[400px] hidden md:block">
          <Image className="object-contain dark:hidden" src='/reading.png' alt="Reading" fill sizes="400px" />
          <Image className="object-contain hidden dark:block" src='/reading-dark.png' alt="Reading" fill sizes="400px" />
        </div>
      </div>
    </div>
)
}