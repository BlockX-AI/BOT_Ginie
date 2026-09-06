import Announcement from '../../components/common/Misc/Announcement';
import AnnouncementBar from '../landing/AnnouncementBar/AnnouncementBar';
import Header from '../../components/navs/Header';
import Sidebar from '../../components/navs/Sidebar';

export default function SidebarLayout({ children }) {
  return (
    <main className="app-container">
      <AnnouncementBar
        message="React Bits Pro is coming: 50+ pro components, 70+ UI blocks, 5+ full templates. Click to join waitlist."
        link="https://pro.reactbits.dev"
        backgroundColor="linear-gradient(to right, #060010, #5227FF, #060010)"
        noBorder={true}
      />
      <Announcement />
      <Header />
      <section className="category-wrapper">
        <Sidebar />
        {children}
      </section>
    </main>
  );
}
