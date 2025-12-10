import Image from "next/image";

export default function HowItWorks() {
  return (
    <section className="w-full max-w-3xl text-white flex flex-col items-center gap-8">
      <div className="text-3xl text-center">how it works</div>

      <div className="flex flex-col w-full gap-8">
        {/* row 1: image | text */}
        <div className="flex flex-row items-stretch justify-center gap-4">
          <div className="w-1/2 flex justify-center">
            <Image
              src="/how_it_works_texts_1.png"
              alt="invite friends via your echo link"
              width={100}
              height={75}
              className="object-contain"
              priority
            />
          </div>
          <div className="w-1/2 text-left space-y-1.5">
            <p className="text-lg">add friends.</p>
            <p className="text-sm text-gray-200 leading-relaxed">
              after signing up, send your friends your echo link to add them
            </p>
          </div>
        </div>

        {/* row 2: text | image */}
        <div className="flex flex-row items-stretch justify-center gap-4">
          <div className="w-1/2 text-left space-y-1.5">
            <p className="text-lg">share songs.</p>
            <p className="text-sm text-gray-200 leading-relaxed">
              next time you&apos;re listening to a good song, just text us the
              link
            </p>
          </div>
          <div className="w-1/2 flex justify-center">
            <Image
              src="/how_it_works_texts_2.png"
              alt="share a spotify song link by text"
              width={100}
              height={75}
              className="object-contain"
            />
          </div>
        </div>

        {/* row 3: image | text */}
        <div className="flex flex-row items-stretch justify-center gap-4">
          <div className="w-1/2 flex justify-center">
            <Image
              src="/how_it_works_texts_3.png"
              alt="discover the playlist from your friends"
              width={100}
              height={150}
              className="object-contain"
            />
          </div>
          <div className="w-1/2 text-left space-y-1.5">
            <p className="text-lg">discover music.</p>
            <p className="text-sm text-gray-200 leading-relaxed">
              every 2 days, we&apos;ll text you with all the songs your friends
              are listening to :)
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
