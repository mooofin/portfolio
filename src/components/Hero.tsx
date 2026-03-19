import NowPlaying from "./NowPlaying";
import DesktopIcons from "./DesktopIcons";
import Folder from "./Folder";

function Hero() {
  return (
    <section id="home" className="hero">
      <div className="hero-left-side">
        <div className="pink-sticky hero-sticky">
          <div className="hero-pfp-row">
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
        </div>

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
        <div className="pink-sticky spotify-sticky">
          <NowPlaying />
        </div>
        <DesktopIcons />
      </div>
    </section>
  );
}

export default Hero;
