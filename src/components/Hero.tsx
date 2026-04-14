import NowPlaying from "./NowPlaying";
import DesktopIcons from "./DesktopIcons";
import Folder from "./Folder";
import GlowCard from "./ui/GlowCard";

function Hero() {
  return (
    <section id="home" className="hero">
      <div className="hero-left-side">
        <GlowCard
          glowColor="#a855f7"
          glowOpacity={0.3}
          className="pink-sticky hero-sticky"
        >
          <div
            className="hero-pfp-row"
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
            }}
          >
            <img src="/images/pfp.jpg" alt="Profile" className="hero-pfp" />
          </div>
          <div className="hero-sticky-text">
            <div>
              Siddharth
              <br />
              <br />
              Loves NixOS and Gentoo, and I enjoy declarative, functional
              programming using Nix
            </div>
          </div>
        </GlowCard>

        <div className="github-card">
          <a
            href="https://github.com/mooofin"
            target="_blank"
            rel="noopener noreferrer"
            className="github-link desktop-shortcut"
          >
            <Folder
              color="#ff69b4"
              size={1}
              items={[
                <img
                  src="/stuff/234.png"
                  alt=""
                  style={{ width: "60%", height: "60%", objectFit: "contain" }}
                />,
              ]}
            />
            <span className="uncenter">GitHub</span>
          </a>
        </div>
      </div>

      <div className="hero-right-side">
        <GlowCard
          glowColor="#ff69b4"
          glowOpacity={0.3}
          borderRadius="0.75rem"
          className="pink-sticky spotify-sticky"
        >
          <NowPlaying />
        </GlowCard>

        <DesktopIcons />
      </div>
    </section>
  );
}

export default Hero;
